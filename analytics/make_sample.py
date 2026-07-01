"""Generate a Shopee-style sample export for testing the pipeline.

    python make_sample.py --out sample_orders.csv --days 180
"""

from __future__ import annotations

import argparse
import csv
import random
import sys
from datetime import datetime, timedelta

try:  # make Thai / arrow output safe on the Windows console (cp1252)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PRODUCTS = [
    ("FIL-PLA-1K", "PLA Filament 1kg", "Filament", 590),
    ("MOD-DRAGON", "Articulated Dragon (Rainbow)", "3D Printed Models", 350),
    ("RES-STD-1L", "Standard Resin 1L", "Resin", 890),
    ("PRT-NOZ-04", "0.4mm Brass Nozzle (5 pcs)", "Printer Parts", 120),
    ("SVC-PRINT", "Custom 3D Printing Service (100g)", "Printing Service", 150),
]
WEEKDAY_FACTOR = [1.02, 1.12, 1.35, 1.25, 0.85, 0.92, 0.98]  # Mon..Sun


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", "-o", default="sample_orders.csv")
    ap.add_argument("--days", type=int, default=180)
    args = ap.parse_args()

    rng = random.Random(20260701)
    end = datetime.now().date()
    rows = []
    order_seq = 1
    for d in range(args.days):
        day = end - timedelta(days=args.days - 1 - d)
        base = 6 + d * 0.03  # gentle upward trend in order count
        campaign = 2.2 if day.day == day.month else 1.0
        n_orders = max(1, int(base * WEEKDAY_FACTOR[day.weekday()] * campaign * (0.8 + rng.random() * 0.4)))
        for _ in range(n_orders):
            sku, name, cat, price = rng.choice(PRODUCTS)
            qty = rng.choice([1, 1, 1, 2, 3])
            discount = rng.choice([0, 0, 0, 20, 50])
            ts = datetime(day.year, day.month, day.day, rng.randint(8, 22), rng.randint(0, 59))
            rows.append(
                {
                    "Order ID": f"25{order_seq:08d}",
                    "Order Status": "Completed",
                    "Order Creation Date": ts.strftime("%Y-%m-%d %H:%M"),
                    "Product Name": name,
                    "SKU Reference No.": sku,
                    "Product Category": cat,
                    "Variation Name": "",
                    "Quantity": qty,
                    "Deal Price": price,
                    "Seller Discount": discount,
                    "Product Subtotal": price * qty - discount,
                    "Province": rng.choice(["Bangkok", "Chiang Mai", "Phuket", "Khon Kaen"]),
                }
            )
            order_seq += 1

    fields = list(rows[0].keys())
    with open(args.out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows):,} rows over {args.days} days → {args.out}")


if __name__ == "__main__":
    main()
