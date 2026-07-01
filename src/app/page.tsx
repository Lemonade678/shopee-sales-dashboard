import DashboardControls from "@/components/DashboardControls";
import KpiCard from "@/components/KpiCard";
import SalesTimeSeriesChart from "@/components/SalesTimeSeriesChart";
import TopProductsTable from "@/components/TopProductsTable";
import CategoryDonut from "@/components/CategoryDonut";
import WeekdaySeasonality from "@/components/WeekdaySeasonality";
import {
  getCategoryBreakdown,
  getKpis,
  getSeries,
  getShops,
  getTopProducts,
  getWeekday,
} from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fmtInt, fmtMoney } from "@/lib/format";
import type { Granularity } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pct(curr: number, prev: number): number {
  if (!prev) return NaN;
  return ((curr - prev) / prev) * 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { shop?: string; range?: string; g?: string };
}) {
  const shops = await getShops();
  const shopId = searchParams.shop ?? shops[0].id;
  const range = searchParams.range ?? "90d";
  const granularity = (searchParams.g ?? "day") as Granularity;
  const days = RANGE_DAYS[range] ?? 90;

  const today = new Date();
  const to = isoDay(today);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  const from = isoDay(fromDate);

  // Previous comparable window for KPI deltas.
  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));

  const query = { shopId, from, to, granularity };
  const prevQuery = { shopId, from: isoDay(prevFrom), to: isoDay(prevTo), granularity };

  const [series, kpis, prevKpis, topProducts, categories, weekday] = await Promise.all([
    getSeries(query),
    getKpis(query),
    getKpis(prevQuery),
    getTopProducts(query, 8),
    getCategoryBreakdown(query),
    getWeekday(query),
  ]);

  const usingDemo = !isSupabaseConfigured() || shopId === "demo-shop";

  // Mini-series for the KPI sparklines (trailing window, capped for readability).
  const tail = <T,>(arr: T[]) => arr.slice(-30);
  const revSpark = tail(series.map((p) => p.revenue));
  const ordSpark = tail(series.map((p) => p.orders));
  const unitSpark = tail(series.map((p) => p.units));
  const aovSpark = tail(series.map((p) => (p.orders ? p.revenue / p.orders : 0)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {from} → {to} · last {days} days
          </p>
        </div>
        <DashboardControls shops={shops} shopId={shopId} range={range} granularity={granularity} />
      </div>

      {usingDemo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing <strong>sample data</strong>. Connect Supabase (see{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>) and{" "}
          <a href="/import" className="font-semibold underline">
            import your Shopee export
          </a>{" "}
          to see real numbers.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={fmtMoney(kpis.revenue)}
          icon="💰"
          accent="#ee4d2d"
          spark={revSpark}
          deltaPct={pct(kpis.revenue, prevKpis.revenue)}
          hint="vs prev period"
        />
        <KpiCard
          label="Orders"
          value={fmtInt(kpis.orders)}
          icon="🧾"
          accent="#0ea5e9"
          spark={ordSpark}
          deltaPct={pct(kpis.orders, prevKpis.orders)}
          hint="vs prev period"
        />
        <KpiCard
          label="Units sold"
          value={fmtInt(kpis.units)}
          icon="📦"
          accent="#10b981"
          spark={unitSpark}
          deltaPct={pct(kpis.units, prevKpis.units)}
          hint="vs prev period"
        />
        <KpiCard
          label="Avg order value"
          value={fmtMoney(kpis.aov)}
          icon="🛒"
          accent="#8b5cf6"
          spark={aovSpark}
          deltaPct={pct(kpis.aov, prevKpis.aov)}
          hint="vs prev period"
        />
      </div>

      <SalesTimeSeriesChart series={series} granularity={granularity} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopProductsTable products={topProducts} />
        </div>
        <CategoryDonut data={categories} />
      </div>

      <WeekdaySeasonality data={weekday} />
    </div>
  );
}
