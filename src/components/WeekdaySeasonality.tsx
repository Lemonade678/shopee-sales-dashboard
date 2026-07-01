"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompactMoney, fmtMoney } from "@/lib/format";
import type { WeekdayPoint } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeekdaySeasonality({ data }: { data: WeekdayPoint[] }) {
  const rows = DOW.map((label, i) => {
    const hit = data.find((d) => d.weekday === i);
    return { label, revenue: hit?.revenue ?? 0 };
  });
  const max = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-base font-semibold text-slate-900">Weekday seasonality</h2>
      <p className="mb-3 text-sm text-slate-500">Which days of the week drive the most revenue</p>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => fmtCompactMoney(v)} width={52} />
            <Tooltip
              formatter={(value: any) => [fmtMoney(Number(value)), "Revenue"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
              {rows.map((r, i) => (
                <Cell key={i} fill={r.revenue === max ? "#ee4d2d" : "#fbcfbf"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
