"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtMoney } from "@/lib/format";
import type { CategorySlice } from "@/lib/types";

const COLORS = ["#ee4d2d", "#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#64748b"];

export default function CategoryDonut({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((a, d) => a + d.revenue, 0);
  return (
    <div className="card p-5">
      <h2 className="mb-2 text-base font-semibold text-slate-900">Revenue by category</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="category"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: string) => {
                const v = Number(value);
                const pct = total ? ((v / total) * 100).toFixed(1) : "0";
                return [`${fmtMoney(v)} (${pct}%)`, name];
              }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
