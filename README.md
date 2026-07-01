# Shopee Sales Analytics Dashboard

A sales analytics & time-series forecasting dashboard for Shopee stores.
Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**,
**Supabase (Postgres)**, and **Recharts**.

- 📊 KPI cards (revenue, orders, units, AOV) with period-over-period deltas
- 📈 Time-series chart with moving average + trend/seasonality **forecast**
- 🏆 Top products, category breakdown, weekday seasonality
- ⬆️ Drag-and-drop importer for Shopee CSV/Excel order exports
- ⚡ Built to scale: all aggregation runs in Postgres (RPCs + materialized view + indexes)

The app runs immediately with **generated sample data** — connect Supabase when
you're ready for real numbers.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. You'll see the dashboard populated with demo data.

## Connect Supabase (for real data)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the contents of `supabase/migrations/0001_init.sql`.
   This creates the tables, indexes, aggregation functions, and the daily
   materialized view.
3. Copy `.env.local.example` → `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...        # server-only, keep secret
   ```

4. Restart `npm run dev`.

## Import your Shopee data

1. In Shopee Seller Center: **Orders → Export** (CSV or Excel).
2. Go to the **Import** page in the app, name your store, and drop the file.
3. The file is parsed in the browser; matched rows are bulk-upserted into
   `sales_records`, and the daily rollup is refreshed automatically.

The importer recognises both **English and Thai** Shopee column headers. To
support a different export template, add header aliases in
[`src/lib/shopee.ts`](src/lib/shopee.ts).

## How it scales

| Concern            | Approach                                                          |
| ------------------ | ---------------------------------------------------------------- |
| Aggregation        | Postgres RPCs (`sales_time_series`, `sales_kpis`, …) — no raw rows sent to the client |
| Fast repeat reads  | `mv_daily_sales` materialized view, refreshed after each import  |
| Query performance  | Composite `(shop_id, order_date)` btree + BRIN on `order_date`   |
| Bulk import        | Chunked upserts (500 rows/batch) with a unique constraint for de-dupe |
| Multi-store        | `shops` table + `shop_id` foreign key on every record            |

### Next steps for production

- Add **Supabase Auth** and tighten the RLS policies in the migration so each
  user only sees their own shops (replace the `using (true)` policies).
- Schedule `refresh_daily_sales()` via `pg_cron` if you ingest continuously.
- Point the time-series RPCs at `mv_daily_sales` for day-granularity queries on
  very large tables.

## Project structure

```
src/
  app/
    page.tsx              Dashboard (Server Component)
    import/page.tsx       CSV/Excel import
    api/import/route.ts   Bulk insert endpoint (service role)
  components/             Charts, KPI cards, uploader
  lib/
    data.ts               Data access — Supabase RPC or demo fallback
    analytics.ts          Moving average, growth, forecast
    shopee.ts             Shopee export column mapping (EN + TH)
    mock.ts               Deterministic sample-data generator
    supabase/             Client factories + env helpers
supabase/migrations/
    0001_init.sql         Schema, indexes, RPCs, materialized view
```
