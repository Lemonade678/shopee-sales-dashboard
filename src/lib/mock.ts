import type {
  CategorySlice,
  Granularity,
  Kpis,
  SeriesPoint,
  TopProduct,
  WeekdayPoint,
} from "./types";

/** Deterministic PRNG so server renders are stable (no hydration drift). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  { sku: "FIL-PLA-1K", name: "PLA Filament 1kg", category: "Filament", price: 590, weight: 14 },
  { sku: "FIL-PETG-1K", name: "PETG Filament 1kg", category: "Filament", price: 690, weight: 9 },
  { sku: "RES-STD-1L", name: "Standard Resin 1L", category: "Resin", price: 890, weight: 7 },
  { sku: "PRT-NOZ-04", name: '0.4mm Brass Nozzle (5 pcs)', category: "Printer Parts", price: 120, weight: 8 },
  { sku: "PRT-PEI-235", name: "PEI Spring Steel Plate 235mm", category: "Printer Parts", price: 450, weight: 6 },
  { sku: "MOD-DRAGON", name: "Articulated Dragon (Rainbow)", category: "3D Printed Models", price: 350, weight: 12 },
  { sku: "MOD-MINI-32", name: "Miniature Figure 32mm", category: "3D Printed Models", price: 180, weight: 8 },
  { sku: "ACC-STAND", name: "Custom Phone Stand", category: "Accessories", price: 220, weight: 7 },
  { sku: "ACC-CABLE", name: "Desk Cable Organizer", category: "Accessories", price: 90, weight: 6 },
  { sku: "SVC-PRINT", name: "Custom 3D Printing Service (100g)", category: "Printing Service", price: 150, weight: 9 },
];

const HISTORY_DAYS = 400;

interface DayAgg {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
  units: number;
}

interface MockDataset {
  days: DayAgg[];
  productTotals: Map<string, { revenue: number; units: number; dates: string[] }>;
}

let cache: MockDataset | null = null;

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function buildDataset(): MockDataset {
  const rand = mulberry32(20260701);
  const weekdayFactor = [0.85, 0.92, 0.98, 1.02, 1.12, 1.35, 1.25]; // Sun..Sat
  const days: DayAgg[] = [];
  const productTotals = new Map<string, { revenue: number; units: number; dates: string[] }>();
  const totalWeight = PRODUCTS.reduce((a, p) => a + p.weight, 0);

  const end = todayUTC();
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const t = HISTORY_DAYS - 1 - i;

    // Upward trend + gentle annual seasonality + campaign spikes on double dates.
    const trend = 8000 + t * 22;
    const annual = 1 + 0.15 * Math.sin((t / 365) * 2 * Math.PI);
    const dow = d.getUTCDay();
    const dom = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    const campaign = dom === month ? 2.4 : dom === 15 ? 1.5 : 1; // 6.6, 7.7 ... & mid-month
    const noise = 0.8 + rand() * 0.4;

    const dayRevenue = trend * annual * weekdayFactor[dow] * campaign * noise;

    // Split revenue across products by weight to build order/unit counts.
    let orders = 0;
    let units = 0;
    const isoDay = d.toISOString().slice(0, 10);
    for (const p of PRODUCTS) {
      const share = (p.weight / totalWeight) * (0.85 + rand() * 0.3);
      const pRevenue = dayRevenue * share;
      const pUnits = Math.max(0, Math.round(pRevenue / p.price));
      if (pUnits === 0) continue;
      units += pUnits;
      orders += Math.max(1, Math.round(pUnits * 0.7));
      const agg = productTotals.get(p.sku) ?? { revenue: 0, units: 0, dates: [] };
      agg.revenue += pUnits * p.price;
      agg.units += pUnits;
      productTotals.set(p.sku, agg);
    }

    days.push({ date: isoDay, revenue: Math.round(dayRevenue), orders, units });
  }

  return { days, productTotals };
}

function dataset(): MockDataset {
  if (!cache) cache = buildDataset();
  return cache;
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function mockSeries(from: string, to: string, granularity: Granularity): SeriesPoint[] {
  const days = dataset().days.filter((d) => inRange(d.date, from, to));
  if (granularity === "day") {
    return days.map((d) => ({ bucket: d.date, revenue: d.revenue, orders: d.orders, units: d.units }));
  }
  const buckets = new Map<string, SeriesPoint>();
  for (const d of days) {
    const key = bucketKey(d.date, granularity);
    const b = buckets.get(key) ?? { bucket: key, revenue: 0, orders: 0, units: 0 };
    b.revenue += d.revenue;
    b.orders += d.orders;
    b.units += d.units;
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function bucketKey(date: string, granularity: Granularity): string {
  const d = new Date(date + "T00:00:00Z");
  if (granularity === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  // week: snap to Monday
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function mockKpis(from: string, to: string): Kpis {
  const days = dataset().days.filter((d) => inRange(d.date, from, to));
  const revenue = days.reduce((a, d) => a + d.revenue, 0);
  const orders = days.reduce((a, d) => a + d.orders, 0);
  const units = days.reduce((a, d) => a + d.units, 0);
  return { revenue, orders, units, aov: orders ? revenue / orders : 0 };
}

export function mockTopProducts(from: string, to: string, limit: number): TopProduct[] {
  // Scale each product's all-time totals by the window's share of history.
  const ds = dataset();
  const windowDays = ds.days.filter((d) => inRange(d.date, from, to)).length;
  const share = ds.days.length ? windowDays / ds.days.length : 1;
  return PRODUCTS.map((p) => {
    const agg = ds.productTotals.get(p.sku);
    return {
      sku: p.sku,
      product_name: p.name,
      revenue: Math.round((agg?.revenue ?? 0) * share),
      units: Math.round((agg?.units ?? 0) * share),
    };
  })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function mockCategoryBreakdown(from: string, to: string): CategorySlice[] {
  const products = mockTopProducts(from, to, PRODUCTS.length);
  const byCat = new Map<string, CategorySlice>();
  for (const p of products) {
    const cat = PRODUCTS.find((x) => x.sku === p.sku)?.category ?? "Uncategorised";
    const c = byCat.get(cat) ?? { category: cat, revenue: 0, units: 0 };
    c.revenue += p.revenue;
    c.units += p.units;
    byCat.set(cat, c);
  }
  return [...byCat.values()].sort((a, b) => b.revenue - a.revenue);
}

export function mockWeekday(from: string, to: string): WeekdayPoint[] {
  const days = dataset().days.filter((d) => inRange(d.date, from, to));
  const rev = new Array(7).fill(0);
  const ord = new Array(7).fill(0);
  for (const d of days) {
    const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
    rev[dow] += d.revenue;
    ord[dow] += d.orders;
  }
  return rev.map((r, i) => ({ weekday: i, revenue: r, orders: ord[i] }));
}
