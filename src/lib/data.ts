import "server-only";
import { getServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import {
  mockCategoryBreakdown,
  mockKpis,
  mockProductBreakdown,
  mockSeries,
  mockTopProducts,
  mockWeekday,
} from "./mock";
import type {
  CategorySlice,
  DashboardQuery,
  Kpis,
  SeriesPoint,
  TopProduct,
  WeekdayPoint,
} from "./types";

import { STORE } from "./config";

export const DEMO_SHOP = { id: "demo-shop", name: `${STORE.name} (sample data)` };

export interface ShopOption {
  id: string;
  name: string;
}

export async function getShops(): Promise<ShopOption[]> {
  const supabase = getServerClient();
  if (!supabase) return [DEMO_SHOP];
  const { data, error } = await supabase.from("shops").select("id, name").order("name");
  if (error || !data || data.length === 0) return [DEMO_SHOP];
  return data as ShopOption[];
}

export async function getSeries(q: DashboardQuery): Promise<SeriesPoint[]> {
  if (!isSupabaseConfigured() || q.shopId === DEMO_SHOP.id) {
    return mockSeries(q.from, q.to, q.granularity);
  }
  const supabase = getServerClient()!;
  const { data, error } = await supabase.rpc("sales_time_series", {
    p_shop: q.shopId,
    p_from: q.from,
    p_to: q.to,
    p_granularity: q.granularity,
  });
  if (error) throw new Error(`sales_time_series: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    bucket: r.bucket,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
    units: Number(r.units),
  }));
}

export async function getKpis(q: DashboardQuery): Promise<Kpis> {
  if (!isSupabaseConfigured() || q.shopId === DEMO_SHOP.id) {
    return mockKpis(q.from, q.to);
  }
  const supabase = getServerClient()!;
  const { data, error } = await supabase.rpc("sales_kpis", {
    p_shop: q.shopId,
    p_from: q.from,
    p_to: q.to,
  });
  if (error) throw new Error(`sales_kpis: ${error.message}`);
  const row = (data ?? [])[0] ?? { revenue: 0, orders: 0, units: 0, aov: 0 };
  return {
    revenue: Number(row.revenue),
    orders: Number(row.orders),
    units: Number(row.units),
    aov: Number(row.aov),
  };
}

export async function getTopProducts(q: DashboardQuery, limit = 10): Promise<TopProduct[]> {
  if (!isSupabaseConfigured() || q.shopId === DEMO_SHOP.id) {
    return mockTopProducts(q.from, q.to, limit);
  }
  const supabase = getServerClient()!;
  const { data, error } = await supabase.rpc("top_products", {
    p_shop: q.shopId,
    p_from: q.from,
    p_to: q.to,
    p_limit: limit,
  });
  if (error) throw new Error(`top_products: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    sku: r.sku,
    product_name: r.product_name,
    revenue: Number(r.revenue),
    units: Number(r.units),
  }));
}

export async function getCategoryBreakdown(q: DashboardQuery): Promise<CategorySlice[]> {
  if (!isSupabaseConfigured() || q.shopId === DEMO_SHOP.id) {
    return mockCategoryBreakdown(q.from, q.to);
  }
  const supabase = getServerClient()!;
  const { data, error } = await supabase.rpc("category_breakdown", {
    p_shop: q.shopId,
    p_from: q.from,
    p_to: q.to,
  });
  if (error) throw new Error(`category_breakdown: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    category: r.category,
    revenue: Number(r.revenue),
    units: Number(r.units),
  }));
}

export interface ProductBreakdownRow {
  product_name: string | null;
  variation: string | null;
  revenue: number;
  units: number;
}

export async function getProductBreakdown(q: DashboardQuery): Promise<ProductBreakdownRow[]> {
  if (!isSupabaseConfigured() || q.shopId === DEMO_SHOP.id) {
    return mockProductBreakdown(q.from, q.to);
  }
  const supabase = getServerClient()!;
  const { data, error } = await supabase.rpc("product_breakdown", {
    p_shop: q.shopId,
    p_from: q.from,
    p_to: q.to,
  });
  if (error) throw new Error(`product_breakdown: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    product_name: r.product_name,
    variation: r.variation,
    revenue: Number(r.revenue),
    units: Number(r.units),
  }));
}

export async function getWeekday(q: DashboardQuery): Promise<WeekdayPoint[]> {
  if (!isSupabaseConfigured() || q.shopId === DEMO_SHOP.id) {
    return mockWeekday(q.from, q.to);
  }
  const supabase = getServerClient()!;
  const { data, error } = await supabase.rpc("sales_by_weekday", {
    p_shop: q.shopId,
    p_from: q.from,
    p_to: q.to,
  });
  if (error) throw new Error(`sales_by_weekday: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    weekday: Number(r.weekday),
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }));
}
