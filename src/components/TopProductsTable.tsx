import { fmtInt, fmtMoney } from "@/lib/format";
import type { TopProduct } from "@/lib/types";

export default function TopProductsTable({ products }: { products: TopProduct[] }) {
  const max = Math.max(1, ...products.map((p) => p.revenue));
  return (
    <div className="card p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Top products</h2>
      <div className="space-y-3">
        {products.length === 0 && <p className="text-sm text-slate-400">No sales in this period.</p>}
        {products.map((p, i) => (
          <div key={p.sku ?? i} className="flex items-center gap-3">
            <span className="w-5 text-sm font-semibold text-slate-400">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-800">
                  {p.product_name ?? p.sku ?? "Unknown"}
                </p>
                <p className="shrink-0 text-sm font-semibold text-slate-900">{fmtMoney(p.revenue)}</p>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(p.revenue / max) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {p.sku ?? "—"} · {fmtInt(p.units)} units
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
