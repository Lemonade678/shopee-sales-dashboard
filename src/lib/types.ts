export type Granularity = "day" | "week" | "month";

export interface SalesRecord {
  shop_id: string;
  order_id: string;
  order_status: string | null;
  order_date: string; // ISO
  sku: string | null;
  product_name: string | null;
  category: string | null;
  variation: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  revenue: number;
  buyer: string | null;
  province: string | null;
}

export interface SeriesPoint {
  bucket: string; // ISO date
  revenue: number;
  orders: number;
  units: number;
}

export interface Kpis {
  revenue: number;
  orders: number;
  units: number;
  aov: number;
}

export interface TopProduct {
  sku: string | null;
  product_name: string | null;
  revenue: number;
  units: number;
}

export interface CategorySlice {
  category: string;
  revenue: number;
  units: number;
}

export interface WeekdayPoint {
  weekday: number; // 0 = Sunday
  revenue: number;
  orders: number;
}

export interface ForecastPoint {
  bucket: string;
  forecast: number;
  lower: number;
  upper: number;
}

export interface DashboardQuery {
  shopId: string;
  from: string; // ISO date
  to: string; // ISO date
  granularity: Granularity;
}
