"""Resample raw sales lines into time frames and compute time-series metrics."""

from __future__ import annotations

import pandas as pd

# Pandas offset alias per time frame.
FREQ = {"D": "D", "W": "W-MON", "M": "MS"}
MA_WINDOW = {"D": 7, "W": 4, "M": 3}


def resample_timeframe(df: pd.DataFrame, freq: str = "D") -> pd.DataFrame:
    """Aggregate order lines into revenue / orders / units / AOV per period.

    freq: 'D' daily, 'W' weekly (week starting Monday), 'M' monthly.
    Returns a DataFrame indexed by period start with a continuous date range
    (missing periods filled with zeros).
    """
    if freq not in FREQ:
        raise ValueError(f"freq must be one of {list(FREQ)}")

    s = df.set_index("order_date").sort_index()
    grouper = pd.Grouper(freq=FREQ[freq])
    agg = s.groupby(grouper).agg(
        revenue=("revenue", "sum"),
        orders=("order_id", "nunique"),
        units=("quantity", "sum"),
    )

    # Fill gaps so the series is continuous (important for MA & forecasting).
    if not agg.empty:
        full = pd.date_range(agg.index.min(), agg.index.max(), freq=FREQ[freq])
        agg = agg.reindex(full, fill_value=0)
    agg.index.name = "period"

    agg["aov"] = (agg["revenue"] / agg["orders"].replace(0, pd.NA)).fillna(0.0)
    return agg


def add_moving_average(ts: pd.DataFrame, freq: str = "D", column: str = "revenue") -> pd.DataFrame:
    """Append a trailing simple moving average column, e.g. 'revenue_ma'."""
    window = MA_WINDOW.get(freq, 7)
    ts = ts.copy()
    ts[f"{column}_ma"] = ts[column].rolling(window=window, min_periods=window).mean()
    return ts


def period_growth(ts: pd.DataFrame, freq: str = "D", column: str = "revenue") -> float:
    """Percent change of the last N periods vs the previous N (N = MA window)."""
    window = MA_WINDOW.get(freq, 7)
    if len(ts) < window * 2:
        return float("nan")
    recent = ts[column].iloc[-window:].sum()
    prior = ts[column].iloc[-window * 2 : -window].sum()
    if prior == 0:
        return float("nan")
    return (recent - prior) / prior * 100.0


def summary_stats(ts: pd.DataFrame) -> dict:
    """Headline numbers over the whole loaded window."""
    revenue = float(ts["revenue"].sum())
    orders = int(ts["orders"].sum())
    units = int(ts["units"].sum())
    return {
        "revenue": revenue,
        "orders": orders,
        "units": units,
        "aov": revenue / orders if orders else 0.0,
        "periods": int(len(ts)),
        "best_period": None if ts.empty else str(ts["revenue"].idxmax().date()),
        "best_period_revenue": float(ts["revenue"].max()) if not ts.empty else 0.0,
    }
