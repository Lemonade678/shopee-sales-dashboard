# AI Automation Team — แมวกินเส้น

A manager–worker AI system that runs analytics automation for the dashboard.
An **AI Manager** (Claude Opus 4.8) inspects its roster, **hires** specialist
worker agents, can **hire new** ones at runtime when a gap exists, and
synthesises a report. Each worker uses tools that read the shop's real data
(via the Supabase RPCs) and records findings that show up on the **/insights**
dashboard page.

```
                 ┌───────────────┐
   goal  ───────▶│  AI Manager   │  list_agents · hire_agent · create_agent · finish
                 └──────┬────────┘
          hires (sub-agents), runs each to completion
        ┌───────────────┼───────────────┬────────────────┐
        ▼               ▼               ▼                ▼
  sales-analyst   inventory-restock  forecaster    colour-analyst  ...
        │  each uses data tools + save_insight
        ▼
   insights  →  Supabase `insights` table  +  agents/output/insights.json  →  /insights page
```

## Run it

```bash
# 1. Add your Anthropic key to .env.local
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local

# 2. Run the default daily briefing
npm run agents

# ...or give it a specific goal
npm run agents -- "Which filament colours should I restock before the 11.11 campaign?"
```

Works with **sample data** out of the box; when Supabase is configured it reads
your real sales and writes insights back to the `insights` table (run
`supabase/migrations/0002_insights.sql` first). View results at `/insights`.

## The roster (`registry.ts`)

| Agent | Role |
| ----- | ---- |
| `sales-analyst` | Revenue/orders/AOV trends, growth, weekday patterns |
| `inventory-restock` | Which filament SKUs/colours to reorder, and when |
| `forecaster` | 14-day revenue trajectory and confidence |
| `colour-analyst` | Winning vs fading materials & colours |
| `anomaly-detector` | Unusual dips/spikes in the daily numbers |

The Manager can **hire new** agents beyond these — they're persisted to
`agents/output/registry.custom.json` and become hireable on the next run.

## Files

| File | Purpose |
| ---- | ------- |
| `run.ts` | CLI entry (`npm run agents`) |
| `manager.ts` | The AI Manager: hire / create / delegate / report |
| `worker.ts` | Runs one worker agent's tool-use loop |
| `registry.ts` | Roster of hireable agents + `createAgent()` |
| `tools.ts` | Worker toolbox (read data + `save_insight`) |
| `data.ts` | Business data (Supabase RPCs or demo fallback) |
| `insights.ts` | Persists findings (Supabase + local JSON) |

## Notes & extension ideas

- **Model & effort:** Manager runs at `effort: "high"`, workers at `"medium"`,
  both with adaptive thinking. Tune in `manager.ts` / `worker.ts`.
- **Scheduling:** wire `npm run agents` to a cron / GitHub Action for a daily
  briefing, or to Supabase `pg_cron` calling a webhook.
- **New tools:** add a data tool in `tools.ts` (schema + executor case) and grant
  it to agents in `registry.ts`.
- **Guardrails:** workers are bounded to 8 tool-steps, the Manager to 14, so a
  run always terminates.
