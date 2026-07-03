import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";

export interface InsightRow {
  title: string;
  body: string;
  severity: "info" | "opportunity" | "warning" | "critical";
  category: string | null;
  recommendation: string | null;
  agent: string | null;
  created_at: string;
}

/**
 * Insights produced by the AI automation team. Reads from Supabase when
 * configured; otherwise falls back to the local file the CLI writes so local
 * runs still surface on the dashboard.
 */
export async function getInsights(limit = 50): Promise<InsightRow[]> {
  if (isSupabaseConfigured()) {
    const supabase = getServerClient()!;
    const { data, error } = await supabase
      .from("insights")
      .select("title, body, severity, category, recommendation, agent, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) return data as InsightRow[];
  }
  try {
    const raw = readFileSync(join(process.cwd(), "agents", "output", "insights.json"), "utf8");
    return (JSON.parse(raw) as InsightRow[]).slice(0, limit);
  } catch {
    return [];
  }
}
