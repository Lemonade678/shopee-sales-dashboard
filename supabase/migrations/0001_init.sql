-- =============================================================================
-- Shopee Sales Analytics — schema, indexes, and aggregation RPCs
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shops (multi-store ready)
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  platform    text not null default 'shopee',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sales records: one row per order line item.
-- Denormalised on purpose so time-series aggregation stays a single-table scan.
-- ---------------------------------------------------------------------------
create table if not exists public.sales_records (
  id            bigint generated always as identity primary key,
  shop_id       uuid not null references public.shops(id) on delete cascade,
  order_id      text not null,
  order_status  text,
  order_date    timestamptz not null,
  sku           text,
  product_name  text,
  category      text,
  variation     text,
  quantity      integer not null default 1,
  unit_price    numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  revenue       numeric(12,2) not null default 0,
  buyer         text,
  province      text,
  created_at    timestamptz not null default now(),
  -- de-dupe key: the same order line should not be imported twice
  unique (shop_id, order_id, sku, variation)
);

-- Composite index that every dashboard query leans on: filter by shop + date range.
create index if not exists idx_sales_shop_date
  on public.sales_records (shop_id, order_date);

create index if not exists idx_sales_shop_sku
  on public.sales_records (shop_id, sku);

create index if not exists idx_sales_shop_category
  on public.sales_records (shop_id, category);

-- Optional but recommended for large tables: BRIN on the time column is tiny and
-- ideal for append-mostly, date-ordered data.
create index if not exists idx_sales_date_brin
  on public.sales_records using brin (order_date);

-- ---------------------------------------------------------------------------
-- Pre-aggregated daily rollup. Refresh after each import for instant charts.
-- ---------------------------------------------------------------------------
create materialized view if not exists public.mv_daily_sales as
select
  shop_id,
  date_trunc('day', order_date)::date as day,
  sum(revenue)                         as revenue,
  count(distinct order_id)             as orders,
  sum(quantity)                        as units
from public.sales_records
where coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid')
group by shop_id, date_trunc('day', order_date)::date;

create unique index if not exists idx_mv_daily_sales_pk
  on public.mv_daily_sales (shop_id, day);

create or replace function public.refresh_daily_sales()
returns void language plpgsql as $$
begin
  refresh materialized view concurrently public.mv_daily_sales;
exception when others then
  -- concurrently requires the unique index + at least one existing populate;
  -- fall back to a plain refresh on the first run.
  refresh materialized view public.mv_daily_sales;
end;
$$;

-- =============================================================================
-- Aggregation RPCs — all heavy lifting happens in Postgres, never on the client.
-- =============================================================================

-- Time series bucketed by day / week / month.
create or replace function public.sales_time_series(
  p_shop        uuid,
  p_from        date,
  p_to          date,
  p_granularity text default 'day'
)
returns table (bucket date, revenue numeric, orders bigint, units bigint)
language sql stable as $$
  select
    date_trunc(
      case p_granularity when 'week' then 'week'
                         when 'month' then 'month'
                         else 'day' end,
      order_date
    )::date as bucket,
    sum(revenue)::numeric        as revenue,
    count(distinct order_id)     as orders,
    sum(quantity)::bigint        as units
  from public.sales_records
  where shop_id = p_shop
    and order_date >= p_from
    and order_date < (p_to + 1)
    and coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid')
  group by 1
  order by 1;
$$;

-- Headline KPIs for the selected window.
create or replace function public.sales_kpis(
  p_shop uuid,
  p_from date,
  p_to   date
)
returns table (
  revenue numeric,
  orders  bigint,
  units   bigint,
  aov     numeric
)
language sql stable as $$
  select
    coalesce(sum(revenue), 0)::numeric                                   as revenue,
    count(distinct order_id)                                             as orders,
    coalesce(sum(quantity), 0)::bigint                                   as units,
    case when count(distinct order_id) = 0 then 0
         else (sum(revenue) / count(distinct order_id))::numeric end     as aov
  from public.sales_records
  where shop_id = p_shop
    and order_date >= p_from
    and order_date < (p_to + 1)
    and coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid');
$$;

-- Best-selling products.
create or replace function public.top_products(
  p_shop  uuid,
  p_from  date,
  p_to    date,
  p_limit int default 10
)
returns table (
  sku          text,
  product_name text,
  revenue      numeric,
  units        bigint
)
language sql stable as $$
  select
    sku,
    max(product_name)      as product_name,
    sum(revenue)::numeric  as revenue,
    sum(quantity)::bigint  as units
  from public.sales_records
  where shop_id = p_shop
    and order_date >= p_from
    and order_date < (p_to + 1)
    and coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid')
  group by sku
  order by revenue desc
  limit p_limit;
$$;

-- Revenue split by category.
create or replace function public.category_breakdown(
  p_shop uuid,
  p_from date,
  p_to   date
)
returns table (category text, revenue numeric, units bigint)
language sql stable as $$
  select
    coalesce(nullif(category, ''), 'Uncategorised') as category,
    sum(revenue)::numeric  as revenue,
    sum(quantity)::bigint  as units
  from public.sales_records
  where shop_id = p_shop
    and order_date >= p_from
    and order_date < (p_to + 1)
    and coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid')
  group by 1
  order by revenue desc;
$$;

-- Per-product/variation aggregates — feeds the filament material & colour view.
-- Returns one row per (sku, variation); material/colour are parsed app-side.
create or replace function public.product_breakdown(
  p_shop uuid,
  p_from date,
  p_to   date
)
returns table (sku text, product_name text, variation text, revenue numeric, units bigint)
language sql stable as $$
  select
    sku,
    max(product_name)            as product_name,
    coalesce(variation, '')      as variation,
    sum(revenue)::numeric        as revenue,
    sum(quantity)::bigint        as units
  from public.sales_records
  where shop_id = p_shop
    and order_date >= p_from
    and order_date < (p_to + 1)
    and coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid')
  group by sku, coalesce(variation, '')
  order by revenue desc;
$$;

-- Sales by weekday (0=Sunday) — feeds the seasonality view.
create or replace function public.sales_by_weekday(
  p_shop uuid,
  p_from date,
  p_to   date
)
returns table (weekday int, revenue numeric, orders bigint)
language sql stable as $$
  select
    extract(dow from order_date)::int as weekday,
    sum(revenue)::numeric             as revenue,
    count(distinct order_id)          as orders
  from public.sales_records
  where shop_id = p_shop
    and order_date >= p_from
    and order_date < (p_to + 1)
    and coalesce(order_status, '') not in ('Cancelled', 'cancelled', 'Unpaid')
  group by 1
  order by 1;
$$;

-- =============================================================================
-- Row Level Security
-- The service-role key (used by the import API) bypasses RLS.
-- The anon key (used by the dashboard) gets read-only access here. Tighten this
-- to per-user / per-shop ownership once you add auth.
-- =============================================================================
alter table public.shops         enable row level security;
alter table public.sales_records enable row level security;

drop policy if exists "read shops" on public.shops;
create policy "read shops" on public.shops
  for select using (true);

drop policy if exists "read sales" on public.sales_records;
create policy "read sales" on public.sales_records
  for select using (true);
