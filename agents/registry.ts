/**
 * The roster of worker agents the Manager can hire. Built-in specialists live
 * here; the Manager can also "hire new" ones at runtime via createAgent(), which
 * are persisted to agents/output/registry.custom.json so they survive restarts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ToolName } from "./tools";

export interface AgentDefinition {
  name: string;
  role: string; // one-line description shown to the Manager
  systemPrompt: string;
  tools: ToolName[];
  builtin?: boolean;
}

const ANALYST_TOOLS: ToolName[] = ["get_kpis", "get_timeseries", "get_top_products", "get_weekday_seasonality", "save_insight"];

const BUILTINS: AgentDefinition[] = [
  {
    name: "sales-analyst",
    role: "Analyses overall sales health — revenue/orders/AOV trends, growth, and weekday patterns.",
    tools: ANALYST_TOOLS,
    builtin: true,
    systemPrompt:
      "You are a sales analyst for a Shopee shop selling R3D 3D-printing filament and printed parts. " +
      "Read the KPIs, time series and weekday data, then record 1-2 of the most decision-useful insights. " +
      "Quantify everything in THB and %. Be concise and specific.",
  },
  {
    name: "inventory-restock",
    role: "Predicts which filament SKUs/colours will run low and when to reorder.",
    tools: ["get_top_products", "get_filament_breakdown", "get_forecast", "save_insight"],
    builtin: true,
    systemPrompt:
      "You are an inventory planner for a filament shop. Using sales velocity (top products, filament " +
      "breakdown) and the revenue forecast, identify which materials/colours are selling fastest and flag " +
      "restock priorities. Record insights with a clear reorder recommendation.",
  },
  {
    name: "forecaster",
    role: "Reads the revenue forecast and calls out the expected trajectory and risks.",
    tools: ["get_timeseries", "get_forecast", "save_insight"],
    builtin: true,
    systemPrompt:
      "You are a demand forecaster. Compare recent actuals with the 14-day forecast and its confidence band. " +
      "Record an insight on the expected revenue trajectory, any inflection, and how confident the forecast is.",
  },
  {
    name: "colour-analyst",
    role: "Finds which filament materials and colours are winning or fading.",
    tools: ["get_filament_breakdown", "get_top_products", "save_insight"],
    builtin: true,
    systemPrompt:
      "You specialise in product-mix analysis for filament. From the material and colour breakdown, identify " +
      "the standout and the underperforming colours/materials, and recommend what to stock more or less of.",
  },
  {
    name: "anomaly-detector",
    role: "Scans for unusual dips or spikes in the daily numbers.",
    tools: ["get_timeseries", "get_kpis", "save_insight"],
    builtin: true,
    systemPrompt:
      "You are an anomaly detector. Look for sudden dips or spikes in daily revenue/orders versus the trend. " +
      "Only record an insight if something genuinely stands out; otherwise record a single 'info' insight that all looks normal.",
  },
];

const here = dirname(fileURLToPath(import.meta.url));
const CUSTOM_FILE = join(here, "output", "registry.custom.json");

function loadCustom(): AgentDefinition[] {
  try {
    return JSON.parse(readFileSync(CUSTOM_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveCustom(defs: AgentDefinition[]): void {
  mkdirSync(dirname(CUSTOM_FILE), { recursive: true });
  writeFileSync(CUSTOM_FILE, JSON.stringify(defs, null, 2));
}

export function listAgents(): AgentDefinition[] {
  return [...BUILTINS, ...loadCustom()];
}

export function getAgent(name: string): AgentDefinition | undefined {
  return listAgents().find((a) => a.name === name);
}

export interface NewAgentSpec {
  name: string;
  role: string;
  systemPrompt: string;
  tools?: ToolName[];
}

/** "Hire new" — register a worker type the Manager invented for this goal. */
export function createAgent(spec: NewAgentSpec): AgentDefinition {
  const name = spec.name.trim().toLowerCase().replace(/\s+/g, "-");
  if (getAgent(name)) throw new Error(`agent '${name}' already exists`);
  const def: AgentDefinition = {
    name,
    role: spec.role,
    systemPrompt: spec.systemPrompt,
    // Default new hires to the full read toolset + save_insight so they're useful immediately.
    tools:
      spec.tools ??
      ["get_kpis", "get_timeseries", "get_top_products", "get_filament_breakdown", "get_forecast", "get_weekday_seasonality", "save_insight"],
    builtin: false,
  };
  const custom = loadCustom();
  custom.push(def);
  saveCustom(custom);
  return def;
}

export const CUSTOM_REGISTRY_PATH = CUSTOM_FILE;
