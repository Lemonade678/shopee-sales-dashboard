"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { forecastRevenue, movingAverage } from "@/lib/analytics";
import { fmtCompactMoney, fmtInt, fmtMoney } from "@/lib/format";
import type { Granularity, SeriesPoint } from "@/lib/types";

type Metric = "revenue" | "orders" | "units";

const METRICS: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "orders", label: "Orders" },
  { key: "units", label: "Units" },
];

const MA_WINDOW: Record<Granularity, number> = { day: 7, week: 4, month: 3 };
const HORIZON: Record<Granularity, number> = { day: 14, week: 6, month: 3 };

interface Props {
  series: SeriesPoint[];
  granularity: Granularity;
}

interface ChartRow {
  bucket: string;
  actual?: number | null;
  ma?: number | null;
  forecast?: number | null;
  band?: [number, number];
}

export default function SalesTimeSeriesChart({ series, granularity }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const rows = useMemo<ChartRow[]>(() => {
    const values = series.map((p) => p[metric]);
    const ma = movingAverage(values, MA_WINDOW[granularity]);
    const base: ChartRow[] = series.map((p, i) => ({
      bucket: p.bucket,
      actual: p[metric],
      ma: ma[i],
    }));

    // Forecast only makes sense on revenue (money) — the model is tuned for it.
    if (metric === "revenue") {
      const fc = forecastRevenue(series, HORIZON[granularity], granularity);
      if (fc.length && base.length) {
        // bridge: attach the last actual to the forecast line for continuity
        base[base.length - 1].forecast = base[base.length - 1].actual ?? null;
        for (const f of fc) {
          base.push({
            bucket: f.bucket,
            forecast: f.forecast,
            band: [f.lower, f.upper],
          });
        }
      }
    }
    return base;
  }, [series, metric, granularity]);

  const isMoney = metric === "revenue";
  const fmtY = isMoney ? fmtCompactMoney : fmtInt;
  const fmtFull = isMoney ? fmtMoney : fmtInt;

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sales over time</h2>
          <p className="text-sm text-slate-500">
            {MA_WINDOW[granularity]}-period moving average
            {isMoney && ` · ${HORIZON[granularity]}-period forecast`}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                metric === m.key ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ee4d2d" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#ee4d2d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={fmtBucket}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => fmtY(v)} width={52} />
            <Tooltip
              formatter={(value: any, name: string) => [fmtFull(Number(value)), name]}
              labelFormatter={(l) => fmtBucket(String(l))}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="band"
              name="Forecast range"
              stroke="none"
              fill="url(#bandFill)"
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name={METRICS.find((m) => m.key === metric)!.label}
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ma"
              name="Moving avg"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="#ee4d2d"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function fmtBucket(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
