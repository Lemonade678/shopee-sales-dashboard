/**
 * Where the agents record what they find. Writes to the Supabase `insights`
 * table when a service-role key is present (so the /insights dashboard page can
 * read them), and always mirrors to agents/output/insights.json for local runs.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(here, "output", "insights.json");

export interface Insight {
  title: string;
  body: string;
  severity: "info" | "opportunity" | "warning" | "critical";
  category: string;
  recommendation?: string;
  agent: string;
  created_at: string;
}

export async function saveInsight(i: Insight): Promise<void> {
  // Local mirror (always).
  try {
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    let existing: Insight[] = [];
    try {
      existing = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    } catch {
      /* first write */
    }
    existing.unshift(i);
    writeFileSync(OUT_FILE, JSON.stringify(existing.slice(0, 200), null, 2));
  } catch {
    /* non-fatal */
  }

  // Supabase (when configured).
  if (URL && SERVICE) {
    const client = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { error } = await client.from("insights").insert({
      title: i.title,
      body: i.body,
      severity: i.severity,
      category: i.category,
      recommendation: i.recommendation ?? null,
      agent: i.agent,
    });
    if (error) throw new Error(`insights insert: ${error.message}`);
  }
}
