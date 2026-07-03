/**
 * The toolbox available to worker agents: read slices of the shop's data, and
 * record findings. Each worker is granted a subset of these by the registry.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  getFilament,
  getForecast,
  getKpis,
  getSeries,
  getTopProducts,
  getWeekday,
  resolveWindow,
  revenueGrowth,
  type Window,
} from "./data";
import { saveInsight } from "./insights";

export type ToolName =
  | "get_kpis"
  | "get_timeseries"
  | "get_top_products"
  | "get_filament_breakdown"
  | "get_forecast"
  | "get_weekday_seasonality"
  | "save_insight";

export const TOOL_SCHEMAS: Record<ToolName, Anthropic.Tool> = {
  get_kpis: {
    name: "get_kpis",
    description: "Headline KPIs for the last 90 days: revenue, orders, units, average order value (THB).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  get_timeseries: {
    name: "get_timeseries",
    description: "Daily revenue/orders/units for the window, plus week-over-week revenue growth %. Returns the last 30 days.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  get_top_products: {
    name: "get_top_products",
    description: "Best-selling products by revenue (SKU, name, revenue, units).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  get_filament_breakdown: {
    name: "get_filament_breakdown",
    description: "Revenue split by filament material (PLA+/PETG/Silk/TPU...) and by colour — the key restock signal.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  get_forecast: {
    name: "get_forecast",
    description: "14-day revenue forecast (trend + weekday seasonality) with lower/upper confidence band.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  get_weekday_seasonality: {
    name: "get_weekday_seasonality",
    description: "Revenue and orders aggregated by day of week (0=Sunday).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  save_insight: {
    name: "save_insight",
    description:
      "Record a concrete, actionable finding for the shop owner. Use sparingly — only for insights backed by the data you read.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short headline, e.g. 'Black PLA+ likely to stock out in ~8 days'." },
        body: { type: "string", description: "1-3 sentences explaining the finding, citing the numbers." },
        severity: { type: "string", enum: ["info", "opportunity", "warning", "critical"] },
        category: { type: "string", description: "e.g. inventory, sales, forecast, customers, marketing." },
        recommendation: { type: "string", description: "The single concrete next action to take." },
      },
      required: ["title", "body", "severity", "category"],
      additionalProperties: false,
    },
  },
};

export function schemasFor(names: ToolName[]): Anthropic.Tool[] {
  return names.map((n) => TOOL_SCHEMAS[n]);
}

/** Build an executor bound to the data window and the calling agent's name. */
export function makeExecutor(win: Window, agentName: string) {
  return async function execute(name: string, input: any): Promise<string> {
    switch (name as ToolName) {
      case "get_kpis":
        return JSON.stringify(await getKpis(win));
      case "get_timeseries": {
        const series = await getSeries(win);
        return JSON.stringify({
          growth_wow_pct: Number(revenueGrowth(series).toFixed(1)),
          recent: series.slice(-30),
        });
      }
      case "get_top_products":
        return JSON.stringify(await getTopProducts(win, 8));
      case "get_filament_breakdown":
        return JSON.stringify(await getFilament(win));
      case "get_forecast": {
        const series = await getSeries(win);
        return JSON.stringify(getForecast(series, 14));
      }
      case "get_weekday_seasonality":
        return JSON.stringify(await getWeekday(win));
      case "save_insight":
        await saveInsight({
          title: input.title,
          body: input.body,
          severity: input.severity,
          category: input.category,
          recommendation: input.recommendation,
          agent: agentName,
          created_at: new Date().toISOString(),
        });
        return JSON.stringify({ ok: true, saved: input.title });
      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  };
}

export type { Window };
export { resolveWindow };
