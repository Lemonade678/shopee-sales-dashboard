"""Command-line time-frame analytics for Shopee exports.

Examples:
    python cli.py --input orders.xlsx --freq D
    python cli.py --input orders.csv --freq W --horizon 8 --out summary.json --series series.csv
"""

from __future__ import annotations

import argparse
import json
import sys

import pandas as pd

try:  # make Thai / arrow output safe on the Windows console (cp1252)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from loader import load_shopee
from timeframe import (
    add_moving_average,
    period_growth,
    resample_timeframe,
    summary_stats,
)
from forecast import forecast_revenue

FREQ_LABEL = {"D": "daily", "W": "weekly", "M": "monthly"}


def top_products(df: pd.DataFrame, limit: int = 10) -> pd.DataFrame:
    g = (
        df.groupby("sku")
        .agg(product_name=("product_name", "first"), revenue=("revenue", "sum"), units=("quantity", "sum"))
        .sort_values("revenue", ascending=False)
        .head(limit)
        .reset_index()
    )
    return g


def category_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    cat = df["category"].replace("", "Uncategorised").fillna("Uncategorised")
    return (
        df.assign(category=cat)
        .groupby("category")
        .agg(revenue=("revenue", "sum"), units=("quantity", "sum"))
        .sort_values("revenue", ascending=False)
        .reset_index()
    )


def build_report(path: str, freq: str, horizon: int | None) -> dict:
    df = load_shopee(path)
    if df.empty:
        raise SystemExit("No usable rows after cleaning (check dates / statuses).")

    ts = resample_timeframe(df, freq)
    ts = add_moving_average(ts, freq)
    fc = forecast_revenue(ts, freq, horizon)

    summary = summary_stats(ts)
    summary["revenue_growth_pct"] = period_growth(ts, freq)

    series = [
        {
            "period": idx.strftime("%Y-%m-%d"),
            "revenue": round(float(row.revenue), 2),
            "orders": int(row.orders),
            "units": int(row.units),
            "aov": round(float(row.aov), 2),
            "revenue_ma": None if pd.isna(row.revenue_ma) else round(float(row.revenue_ma), 2),
        }
        for idx, row in ts.iterrows()
    ]
    forecast = [
        {
            "period": idx.strftime("%Y-%m-%d"),
            "forecast": round(float(row.forecast), 2),
            "lower": round(float(row.lower), 2),
            "upper": round(float(row.upper), 2),
        }
        for idx, row in fc.iterrows()
    ]

    return {
        "frequency": FREQ_LABEL[freq],
        "summary": summary,
        "series": series,
        "forecast": forecast,
        "top_products": top_products(df).to_dict(orient="records"),
        "categories": category_breakdown(df).to_dict(orient="records"),
    }


def print_console(report: dict) -> None:
    s = report["summary"]
    print(f"\n  Time frame : {report['frequency']}  ({s['periods']} periods)")
    print(f"  Revenue    : {s['revenue']:>14,.0f} THB")
    print(f"  Orders     : {s['orders']:>14,}")
    print(f"  Units      : {s['units']:>14,}")
    print(f"  AOV        : {s['aov']:>14,.0f} THB")
    g = s.get("revenue_growth_pct")
    if g == g:  # not NaN
        print(f"  Growth     : {g:>+13.1f} %  (recent vs prior window)")
    print(f"  Best day   : {s['best_period']}  ({s['best_period_revenue']:,.0f} THB)")

    print("\n  Top products")
    for i, p in enumerate(report["top_products"][:5], 1):
        name = p.get("product_name") or p.get("sku") or "—"
        print(f"    {i}. {name[:34]:<34} {p['revenue']:>12,.0f} THB")

    if report["forecast"]:
        f = report["forecast"]
        total = sum(x["forecast"] for x in f)
        print(f"\n  Forecast (next {len(f)} periods): ~{total:,.0f} THB")
        print(f"    {f[0]['period']} → {f[-1]['period']}")
    print()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Shopee time-frame analytics")
    ap.add_argument("--input", "-i", required=True, help="Shopee export (.csv/.xlsx)")
    ap.add_argument("--freq", "-f", default="D", choices=["D", "W", "M"], help="time frame")
    ap.add_argument("--horizon", type=int, default=None, help="forecast periods")
    ap.add_argument("--out", "-o", help="write full report as JSON")
    ap.add_argument("--series", help="write the resampled series as CSV")
    args = ap.parse_args(argv)

    report = build_report(args.input, args.freq, args.horizon)
    print_console(report)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"  → wrote {args.out}")
    if args.series:
        pd.DataFrame(report["series"]).to_csv(args.series, index=False)
        print(f"  → wrote {args.series}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
