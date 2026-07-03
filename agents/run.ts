/**
 * Entry point for the AI automation team.
 *
 *   npm run agents                     # runs the default daily-briefing goal
 *   npm run agents -- "your goal..."   # runs a custom goal
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { runManager } from "./manager";
import { resolveWindow, usingRealData } from "./data";

const here = dirname(fileURLToPath(import.meta.url));
// Load the same .env.local the dashboard uses.
config({ path: join(here, "..", ".env.local") });

const DEFAULT_GOAL =
  "Run the daily automation briefing: assess sales health, forecast the next two weeks, flag any " +
  "restock priorities by filament colour/material, and surface anything unusual. Record the key insights.";

function log(line: string) {
  console.log(line);
}

async function main() {
  const goal = process.argv.slice(2).join(" ").trim() || DEFAULT_GOAL;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      "\n  Missing ANTHROPIC_API_KEY.\n" +
        "  Add it to .env.local (or the environment) to run the AI team:\n" +
        "    ANTHROPIC_API_KEY=sk-ant-...\n" +
        "  Get a key at https://console.anthropic.com/settings/keys\n"
    );
    process.exit(1);
  }

  const client = new Anthropic();
  const win = await resolveWindow();

  console.log("\n🐱  แมวกินเส้น — AI automation team");
  console.log(`    data source : ${usingRealData ? "Supabase (live)" : "sample data"}`);
  console.log(`    window      : ${win.from} → ${win.to}`);
  console.log(`    goal        : ${goal}\n`);
  console.log("  Manager is planning...\n");

  const started = Date.now();
  const result = await runManager(client, goal, win, log);
  const secs = ((Date.now() - started) / 1000).toFixed(0);

  console.log("\n" + "─".repeat(64));
  console.log("  MANAGER REPORT");
  console.log("─".repeat(64) + "\n");
  console.log(result.report + "\n");
  console.log("─".repeat(64));
  console.log(`  hired: ${result.hired.join(", ") || "none"}`);
  if (result.created.length) console.log(`  newly hired agents: ${result.created.join(", ")}`);
  console.log(`  insights saved to agents/output/insights.json${usingRealData ? " + Supabase" : ""}`);
  console.log(`  done in ${secs}s\n`);
}

main().catch((e) => {
  console.error("\n  Run failed:", e?.message ?? e, "\n");
  process.exit(1);
});
