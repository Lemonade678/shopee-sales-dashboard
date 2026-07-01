/**
 * Verify the Supabase setup: env vars, table access, and that the migration's
 * RPCs exist. Run after creating your project and pasting the migration SQL.
 *
 *   node scripts/check-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dependency on Next's runtime).
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* file optional */
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`);

if (!url || !anon) {
  bad("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}
ok(`URL & anon key present (${url})`);
if (service) ok("Service-role key present (imports enabled)");
else bad("SUPABASE_SERVICE_ROLE_KEY missing — CSV import will be disabled");

const db = createClient(url, service || anon, { auth: { persistSession: false } });

const today = new Date().toISOString().slice(0, 10);
let failures = 0;

// 1) tables reachable
{
  const { error } = await db.from("shops").select("id").limit(1);
  if (error) {
    bad(`Table 'shops' not reachable: ${error.message} — did you run the migration?`);
    failures++;
  } else ok("Table 'shops' reachable");
}

// 2) each RPC exists & runs
const rpcs = [
  ["sales_kpis", { p_shop: "00000000-0000-0000-0000-000000000000", p_from: today, p_to: today }],
  ["sales_time_series", { p_shop: "00000000-0000-0000-0000-000000000000", p_from: today, p_to: today, p_granularity: "day" }],
  ["top_products", { p_shop: "00000000-0000-0000-0000-000000000000", p_from: today, p_to: today, p_limit: 5 }],
  ["category_breakdown", { p_shop: "00000000-0000-0000-0000-000000000000", p_from: today, p_to: today }],
  ["sales_by_weekday", { p_shop: "00000000-0000-0000-0000-000000000000", p_from: today, p_to: today }],
];
for (const [name, args] of rpcs) {
  const { error } = await db.rpc(name, args);
  if (error) {
    bad(`RPC ${name}(): ${error.message}`);
    failures++;
  } else ok(`RPC ${name}() OK`);
}

console.log();
if (failures) {
  bad(`${failures} check(s) failed. Re-run supabase/migrations/0001_init.sql in the SQL editor.`);
  process.exit(1);
}
ok("All good — Supabase is wired up. Start the app with `npm run dev`.");
