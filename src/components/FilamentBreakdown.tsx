import { fmtInt, fmtMoney } from "@/lib/format";
import type { Segment } from "@/lib/filament";

const MATERIAL_HEX: Record<string, string> = {
  "PLA+": "#ee4d2d",
  "PLA Matte": "#f59e0b",
  "Silk PLA": "#eab308",
  PETG: "#0ea5e9",
  PLA: "#10b981",
  ABS: "#8b5cf6",
  TPU: "#ec4899",
  "3D Parts / Other": "#94a3b8",
};

function Row({ seg, swatch, barHex }: { seg: Segment & { pct: number }; swatch?: string; barHex: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-4 w-4 shrink-0 rounded-full border border-slate-200"
        style={{ backgroundColor: swatch ?? barHex }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-800">{seg.label}</p>
          <p className="shrink-0 text-sm font-semibold text-slate-900">{fmtMoney(seg.revenue)}</p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${seg.pct}%`, backgroundColor: barHex }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-slate-400">{fmtInt(seg.units)} pcs</span>
        </div>
      </div>
    </div>
  );
}

// Segment augmented with a precomputed width percentage.
type SegWithPct = Segment & { pct: number };

function withPct(segments: Segment[]): SegWithPct[] {
  const max = Math.max(1, ...segments.map((s) => s.revenue));
  return segments.map((s) => ({ ...s, pct: (s.revenue / max) * 100 }));
}

interface Props {
  byMaterial: Segment[];
  byColour: Segment[];
}

export default function FilamentBreakdown({ byMaterial, byColour }: Props) {
  const materials = withPct(byMaterial);
  const colours = withPct(byColour);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="section-title mb-1">Sales by filament type</h2>
        <p className="mb-4 text-sm text-slate-500">Which materials drive revenue</p>
        <div className="space-y-3">
          {materials.length === 0 && <p className="text-sm text-slate-400">No sales in this period.</p>}
          {materials.map((s) => (
            <Row key={s.key} seg={s} barHex={MATERIAL_HEX[s.key] ?? "#ee4d2d"} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="section-title mb-1">Sales by colour</h2>
        <p className="mb-4 text-sm text-slate-500">Restock the colours that move fastest</p>
        <div className="space-y-3">
          {colours.length === 0 && (
            <p className="text-sm text-slate-400">No colour info detected in this period.</p>
          )}
          {colours.map((s) => (
            <Row key={s.key} seg={s} swatch={s.hex} barHex={s.hex ?? "#94a3b8"} />
          ))}
        </div>
      </div>
    </div>
  );
}
