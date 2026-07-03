/**
 * Business-data access for the agent fleet. Standalone (no `server-only`) so it
 * runs under tsx. Reads real numbers from Supabase RPCs when configured, and
 * falls back to the dashboard's deterministic demo data otherwise — so the
 * agents have something to reason about even before a database is connected.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  mockCategoryBreakdown,
  mockKpis,
  mockProductBreakdown,
  mockSeries,
  mockTopProducts,
  mockWeekday,
} from "../src/lib/mock";
import { forecastRevenue, periodGrowth } from "../src/lib/analytics";
import { aggregateFilament } from "../src/lib/filament";
import type { Kpis, SeriesPoint } from "../src/lib/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const usingRealData = Boolean(URL && (SERVICE || ANON));

let client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!usingRealData) return null;
  if (!client) client = createClient(URL, SERVICE || ANON, { auth: { persistSession: false } });
  return client;
}

const WINDOW_DAYS = 90;
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export interface Window {
  shopId: string;
  from: string;
  to: string;
}

export async function resolveWindow(): Promise<Window> {
  const today = new Date();
  const to = isoDay(today);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (WINDOW_DAYS - 1));
  const from = isoDay(fromDate);

  let shopId = "demo-shop";
  const supabase = db();
  if (supabase) {
    const { data } = await supabase.from("shops").select("id").order("name").limit(1);
    if (data && data.length) shopId = data[0].id as string;
  }
  return { shopId, from, to };
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T[] | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function getKpis(w: Window): Promise<Kpis> {
  const rows = await rpc<any>("sales_kpis", { p_shop: w.shopId, p_from: w.from, p_to: w.to });
  if (!rows) return mockKpis(w.from, w.to);
  const r = rows[0] ?? { revenue: 0, orders: 0, units: 0, aov: 0 };
  return { revenue: +r.revenue, orders: +r.orders, units: +r.units, aov: +r.aov };
}

export async function getSeries(w: Window): Promise<SeriesPoint[]> {
  const rows = await rpc<any>("sales_time_series", {
    p_shop: w.shopId,
    p_from: w.from,
    p_to: w.to,
    p_granularity: "day",
  });
  if (!rows) return mockSeries(w.from, w.to, "day");
  return rows.map((r) => ({ bucket: r.bucket, revenue: +r.revenue, orders: +r.orders, units: +r.units }));
}

export async function getTopProducts(w: Window, limit = 8) {
  const rows = await rpc<any>("top_products", { p_shop: w.shopId, p_from: w.from, p_to: w.to, p_limit: limit });
  if (!rows) return mockTopProducts(w.from, w.to, limit);
  return rows.map((r) => ({ sku: r.sku, product_name: r.product_name, revenue: +r.revenue, units: +r.units }));
}

export async function getCategories(w: Window) {
  const rows = await rpc<any>("category_breakdown", { p_shop: w.shopId, p_from: w.from, p_to: w.to });
  if (!rows) return mockCategoryBreakdown(w.from, w.to);
  return rows.map((r) => ({ category: r.category, revenue: +r.revenue, units: +r.units }));
}

export async function getWeekday(w: Window) {
  const rows = await rpc<any>("sales_by_weekday", { p_shop: w.shopId, p_from: w.from, p_to: w.to });
  if (!rows) return mockWeekday(w.from, w.to);
  return rows.map((r) => ({ weekday: +r.weekday, revenue: +r.revenue, orders: +r.orders }));
}

export async function getFilament(w: Window) {
  const rows = await rpc<any>("product_breakdown", { p_shop: w.shopId, p_from: w.from, p_to: w.to });
  const products = rows
    ? rows.map((r) => ({ product_name: r.product_name, variation: r.variation, revenue: +r.revenue, units: +r.units }))
    : mockProductBreakdown(w.from, w.to);
  return aggregateFilament(products);
}

export function getForecast(series: SeriesPoint[], horizon = 14) {
  return forecastRevenue(series, horizon, "day");
}

export function revenueGrowth(series: SeriesPoint[]) {
  return periodGrowth(series.map((p) => p.revenue), 7);
}
