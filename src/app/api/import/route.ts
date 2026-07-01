import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { STORE } from "@/lib/config";
import type { SalesRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK = 500;

interface ImportBody {
  shopName?: string;
  records?: Omit<SalesRecord, "shop_id">[];
}

export async function POST(req: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured on the server." },
      { status: 503 }
    );
  }

  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const shopName = (body.shopName ?? "").trim() || STORE.name;
  const records = body.records ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "No records to import." }, { status: 400 });
  }
  if (records.length > 200_000) {
    return NextResponse.json(
      { error: "Too many rows in one upload. Split the file into batches." },
      { status: 413 }
    );
  }

  // Find or create the shop.
  let shopId: string;
  const { data: existing, error: findErr } = await supabase
    .from("shops")
    .select("id")
    .eq("name", shopName)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: `Lookup failed: ${findErr.message}` }, { status: 500 });
  }
  if (existing) {
    shopId = existing.id as string;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("shops")
      .insert({ name: shopName, platform: "shopee" })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: `Could not create shop: ${createErr?.message}` },
        { status: 500 }
      );
    }
    shopId = created.id as string;
  }

  // Batched upsert. Duplicate order lines are ignored via the unique constraint.
  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK).map((r) => ({ ...r, shop_id: shopId }));
    const { data, error } = await supabase
      .from("sales_records")
      .upsert(chunk, {
        onConflict: "shop_id,order_id,sku,variation",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      return NextResponse.json(
        { error: `Insert failed at row ${i}: ${error.message}`, inserted },
        { status: 500 }
      );
    }
    inserted += data?.length ?? 0;
  }

  // Refresh the daily rollup so the dashboard reflects the new data immediately.
  let note = "";
  const { error: refreshErr } = await supabase.rpc("refresh_daily_sales");
  if (refreshErr) note = "(rollup refresh skipped — run refresh_daily_sales() manually)";

  const duplicates = records.length - inserted;
  if (duplicates > 0) note = `${duplicates} duplicate rows skipped. ${note}`.trim();

  return NextResponse.json({ ok: true, shop: shopName, inserted, note });
}
