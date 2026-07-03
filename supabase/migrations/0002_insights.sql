-- =============================================================================
-- AI automation: insights produced by the agent team, shown on /insights.
-- Run after 0001_init.sql.
-- =============================================================================

create table if not exists public.insights (
  id             bigint generated always as identity primary key,
  title          text not null,
  body           text not null,
  severity       text not null default 'info'
                   check (severity in ('info', 'opportunity', 'warning', 'critical')),
  category       text,
  recommendation text,
  agent          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_insights_created on public.insights (created_at desc);

-- Optional: persisted definitions for agents the Manager "hired new".
-- The CLI mirrors these to agents/output/registry.custom.json regardless.
create table if not exists public.agent_definitions (
  id            bigint generated always as identity primary key,
  name          text unique not null,
  role          text,
  system_prompt text,
  created_at    timestamptz not null default now()
);

alter table public.insights enable row level security;

drop policy if exists "read insights" on public.insights;
create policy "read insights" on public.insights
  for select using (true);
