import Uploader from "@/components/Uploader";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const ready = isServiceRoleConfigured();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Import Shopee data</h1>
        <p className="text-sm text-slate-500">
          Upload an order export from Shopee Seller Center (Orders → Export). The file is parsed in
          your browser; only clean rows are sent to your database.
        </p>
      </div>

      {!ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase is not configured yet. Add <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>, then run the SQL in{" "}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/0001_init.sql</code>.
          You can still preview parsing below.
        </div>
      )}

      <Uploader />
    </div>
  );
}
