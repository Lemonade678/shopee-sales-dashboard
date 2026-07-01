"""Load a Shopee order export (CSV or Excel) into a tidy DataFrame."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from shopee_columns import EXCLUDED_STATUSES, build_header_map


def _to_number(series: pd.Series) -> pd.Series:
    # Strip currency symbols / thousands separators, coerce to float.
    cleaned = (
        series.astype(str)
        .str.replace(r"[^0-9.\-]", "", regex=True)
        .replace("", np.nan)
    )
    return pd.to_numeric(cleaned, errors="coerce").fillna(0.0)


def load_shopee(path: str | Path) -> pd.DataFrame:
    """Read an export file and return normalised sales-line rows.

    Columns: order_id, order_date, order_status, sku, product_name, category,
    variation, quantity, unit_price, discount, revenue, buyer, province.
    """
    path = Path(path)
    if path.suffix.lower() == ".csv":
        raw = pd.read_csv(path, dtype=str, keep_default_na=False)
    else:
        raw = pd.read_excel(path, dtype=str)

    hmap = build_header_map(list(raw.columns))
    for required in ("order_id", "order_date"):
        if required not in hmap:
            raise ValueError(
                f"Required column '{required}' not found. "
                f"Detected columns: {list(hmap.keys())}"
            )

    df = pd.DataFrame()
    df["order_id"] = raw[hmap["order_id"]].astype(str).str.strip()
    df["order_date"] = pd.to_datetime(raw[hmap["order_date"]], errors="coerce")
    df["order_status"] = raw[hmap["order_status"]] if "order_status" in hmap else ""
    df["sku"] = raw[hmap["sku"]] if "sku" in hmap else ""
    df["product_name"] = raw[hmap["product_name"]] if "product_name" in hmap else ""
    df["category"] = raw[hmap["category"]] if "category" in hmap else ""
    df["variation"] = raw[hmap["variation"]] if "variation" in hmap else ""
    df["quantity"] = _to_number(raw[hmap["quantity"]]) if "quantity" in hmap else 1
    df["quantity"] = df["quantity"].clip(lower=1).round().astype(int)
    df["unit_price"] = _to_number(raw[hmap["unit_price"]]) if "unit_price" in hmap else 0.0
    df["discount"] = _to_number(raw[hmap["discount"]]) if "discount" in hmap else 0.0

    subtotal = _to_number(raw[hmap["subtotal"]]) if "subtotal" in hmap else pd.Series(0.0, index=raw.index)
    derived = (df["unit_price"] * df["quantity"] - df["discount"]).clip(lower=0)
    df["revenue"] = np.where(subtotal > 0, subtotal, derived)

    df["buyer"] = raw[hmap["buyer"]] if "buyer" in hmap else ""
    df["province"] = raw[hmap["province"]] if "province" in hmap else ""

    # Drop rows without a usable date, then exclude cancelled/unpaid.
    df = df.dropna(subset=["order_date"])
    status = df["order_status"].astype(str).str.strip().str.lower()
    df = df[~status.isin(EXCLUDED_STATUSES)].reset_index(drop=True)
    return df
