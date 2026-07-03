import { getInsights, type InsightRow } from "@/lib/insights";

export const dynamic = "force-dynamic";

const SEVERITY: Record<InsightRow["severity"], { label: string; cls: string; icon: string }> = {
  critical: { label: "Critical", cls: "border-rose-200 bg-rose-50 text-rose-700", icon: "🚨" },
  warning: { label: "Warning", cls: "border-amber-200 bg-amber-50 text-amber-700", icon: "⚠️" },
  opportunity: { label: "Opportunity", cls: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: "🌱" },
  info: { label: "Info", cls: "border-slate-200 bg-slate-50 text-slate-600", icon: "💡" },
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function InsightsPage() {
  const insights = await getInsights();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Insights</h1>
        <p className="text-sm text-slate-500">
          Findings from the automation team. Run <code className="rounded bg-slate-100 px-1">npm run agents</code> to
          generate a fresh batch.
        </p>
      </div>

      {insights.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-3xl">🤖</div>
          <p className="mt-3 text-sm font-medium text-slate-700">No insights yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add <code className="rounded bg-slate-100 px-1">ANTHROPIC_API_KEY</code> to{" "}
            <code className="rounded bg-slate-100 px-1">.env.local</code>, then run{" "}
            <code className="rounded bg-slate-100 px-1">npm run agents</code>.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {insights.map((i, idx) => {
          const s = SEVERITY[i.severity] ?? SEVERITY.info;
          return (
            <div key={idx} className="card card-hover p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
                  {s.icon} {s.label}
                </span>
                {i.category && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {i.category}
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {i.agent && <span className="font-medium text-slate-500">{i.agent}</span>} · {timeAgo(i.created_at)}
                </span>
              </div>

              <h2 className="mt-3 text-base font-semibold text-slate-900">{i.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{i.body}</p>

              {i.recommendation && (
                <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                  <span className="font-semibold">→ Action: </span>
                  {i.recommendation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
