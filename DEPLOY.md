# Deploy guide — Supabase + Vercel

Two accounts to set up (both have free tiers). ~15 minutes total.

---

## 1. Supabase (database)

### 1.1 Create the project
1. Sign in at [supabase.com](https://supabase.com) → **New project**.
2. Name it e.g. `maew-kin-sen`, pick a region close to Thailand
   (**Singapore** is the nearest), set a database password, **Create**.

### 1.2 Run the migration
1. Open the project → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
   This creates the tables, indexes, aggregation RPCs, and the daily materialized view.

### 1.3 Get your keys
Project → **Settings → API**:
| Value | Goes into |
| ----- | --------- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` (server-only) |

### 1.4 Wire up locally & verify
```bash
cp .env.local.example .env.local     # then paste the three values
npm run check:supabase               # should print all ✓
npm run dev                          # dashboard now reads real data
```

Then open **Import**, drop a Shopee export, and your numbers go live.

---

## 2. Vercel (hosting)

The repo is already deploy-ready (no config needed — Vercel auto-detects Next.js).

### 2.1 Import the repo
1. Sign in at [vercel.com](https://vercel.com) with your **GitHub** account.
2. **Add New… → Project** → import **`Lemonade678/shopee-sales-dashboard`**.
3. Framework preset is auto-detected as **Next.js**. Leave build settings default.

### 2.2 Add environment variables
Before the first deploy, expand **Environment Variables** and add the same three
from Supabase (apply to Production, Preview, Development):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` is a **secret** — Vercel keeps it server-side.
> It is only read by the import API route, never shipped to the browser.

### 2.3 Deploy
Click **Deploy**. You get a live URL like `https://shopee-sales-dashboard.vercel.app`.
Every `git push` to `main` auto-deploys; pull requests get preview URLs.

### 2.4 (Optional) Restrict data access
The default RLS policies are read-open (`using (true)`). Before sharing the URL
publicly, add Supabase Auth and scope the policies to each user's own shop — see
the note at the bottom of the migration file.

---

## Keep the daily rollup fresh (optional, for continuous ingestion)
The import flow refreshes `mv_daily_sales` automatically. If you also load data
another way, schedule it in Supabase (Database → **Cron**):
```sql
select cron.schedule('refresh-daily-sales', '*/30 * * * *',
  $$ select public.refresh_daily_sales(); $$);
```
