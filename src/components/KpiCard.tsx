import { fmtPct } from "@/lib/format";
import Sparkline from "./Sparkline";

interface KpiCardProps {
  label: string;
  value: string;
  icon?: string;
  accent?: string;
  spark?: number[];
  deltaPct?: number;
  hint?: string;
}

export default function KpiCard({
  label,
  value,
  icon,
  accent = "#ee4d2d",
  spark,
  deltaPct,
  hint,
}: KpiCardProps) {
  const showDelta = deltaPct !== undefined && isFinite(deltaPct);
  const positive = (deltaPct ?? 0) >= 0;
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
              style={{ backgroundColor: `${accent}14`, color: accent }}
            >
              {icon}
            </span>
          )}
          <p className="text-sm font-medium text-slate-500">{label}</p>
        </div>
        {showDelta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {positive ? "▲" : "▼"} {fmtPct(deltaPct!, false)}
          </span>
        )}
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>

      <div className="mt-2 flex items-end justify-between gap-2">
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
        {spark && spark.length > 1 && (
          <div className="ml-auto">
            <Sparkline data={spark} color={accent} />
          </div>
        )}
      </div>
    </div>
  );
}
