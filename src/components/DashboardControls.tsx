"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Granularity } from "@/lib/types";
import type { ShopOption } from "@/lib/data";

const RANGES = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "180d", label: "180D" },
  { key: "365d", label: "1Y" },
];

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

interface Props {
  shops: ShopOption[];
  shopId: string;
  range: string;
  granularity: Granularity;
}

export default function DashboardControls({ shops, shopId, range, granularity }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) next.set(k, v);
      router.push(`/?${next.toString()}`);
    },
    [params, router]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={shopId}
        onChange={(e) => update({ shop: e.target.value })}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => update({ range: r.key })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              range === r.key ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
        {GRANULARITIES.map((g) => (
          <button
            key={g.key}
            onClick={() => update({ g: g.key })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              granularity === g.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
