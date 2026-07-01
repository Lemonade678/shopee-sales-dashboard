"""Optional: push a Shopee export straight into Supabase from Python.

This is an alternative to the web Import page — handy for scheduled/batch loads.

Setup:
    pip install supabase python-dotenv
    # in .env (or the project's .env.local):
    #   NEXT_PUBLIC_SUPABASE_URL=...
    #   SUPABASE_SERVICE_ROLE_KEY=...

Usage:
    python load_to_supabase.py --input sample_orders.csv --shop "แมวกินเส้น"
"""

from __future__ import annotations

import argparse
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from loader import load_shopee

CHUNK = 500


def get_client():
    try:
        from supabase import create_client
    except ImportError:
        raise SystemExit("Install the client first:  pip install supabase python-dotenv")

    try:
        from dotenv import load_dotenv

        # look for .env then the Next app's .env.local
        load_dotenv()
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
    except ImportError:
        pass

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")
    return create_client(url, key)


def main() -> None:
    ap = argparse.ArgumentParser(description="Load a Shopee export into Supabase")
    ap.add_argument("--input", "-i", required=True)
    ap.add_argument("--shop", default="แมวกินเส้น", help="store name to group rows under")
    args = ap.parse_args()

    client = get_client()

    # find or create the shop
    existing = client.table("shops").select("id").eq("name", args.shop).limit(1).execute()
    if existing.data:
        shop_id = existing.data[0]["id"]
    else:
        created = client.table("shops").insert({"name": args.shop, "platform": "shopee"}).execute()
        shop_id = created.data[0]["id"]

    df = load_shopee(args.input)
    df["order_date"] = df["order_date"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    records = df.to_dict(orient="records")
    for r in records:
        r["shop_id"] = shop_id

    inserted = 0
    for i in range(0, len(records), CHUNK):
        chunk = records[i : i + CHUNK]
        res = (
            client.table("sales_records")
            .upsert(chunk, on_conflict="shop_id,order_id,sku,variation", ignore_duplicates=True)
            .execute()
        )
        inserted += len(res.data or [])
        print(f"  ...{min(i + CHUNK, len(records)):>6}/{len(records)} rows")

    client.rpc("refresh_daily_sales").execute()
    print(f"Done. Inserted {inserted:,} new rows into '{args.shop}'.")


if __name__ == "__main__":
    main()
