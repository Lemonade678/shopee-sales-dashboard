"""Revenue forecasting for the resampled time series.

Primary model: Holt-Winters exponential smoothing (statsmodels), with weekly
seasonality for daily data. Falls back to an OLS linear trend + weekday
seasonality when statsmodels is unavailable or the history is too short — this
mirrors the forecast in the web app (src/lib/analytics.ts).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

HORIZON = {"D": 14, "W": 6, "M": 3}
SEASONAL_PERIODS = {"D": 7, "W": 52, "M": 12}


def _linear_forecast(ts: pd.DataFrame, horizon: int, freq: str) -> pd.DataFrame:
    y = ts["revenue"].to_numpy(dtype=float)
    n = len(y)
    x = np.arange(n)
    slope, intercept = np.polyfit(x, y, 1)

    seasonal = np.ones(7)
    if freq == "D":
        trend = intercept + slope * x
        with np.errstate(divide="ignore", invalid="ignore"):
            ratio = np.where(trend > 0, y / trend, np.nan)
        dow = ts.index.dayofweek.to_numpy()  # 0 = Monday
        for d in range(7):
            vals = ratio[dow == d]
            vals = vals[np.isfinite(vals)]
            seasonal[d] = vals.mean() if len(vals) else 1.0

    fitted = intercept + slope * x
    if freq == "D":
        fitted = fitted * seasonal[ts.index.dayofweek.to_numpy()]
    resid_std = np.sqrt(np.sum((y - fitted) ** 2) / max(1, n - 2))

    future_idx = pd.date_range(ts.index[-1], periods=horizon + 1, freq=ts.index.freq)[1:]
    rows = []
    for h, ts_i in enumerate(future_idx, start=1):
        idx = n - 1 + h
        point = intercept + slope * idx
        if freq == "D":
            point *= seasonal[ts_i.dayofweek]
        point = max(0.0, point)
        margin = 1.96 * resid_std * np.sqrt(h)
        rows.append((ts_i, point, max(0.0, point - margin), point + margin))
    return pd.DataFrame(rows, columns=["period", "forecast", "lower", "upper"]).set_index("period")


def forecast_revenue(ts: pd.DataFrame, freq: str = "D", horizon: int | None = None) -> pd.DataFrame:
    """Return a DataFrame indexed by future period with forecast/lower/upper."""
    horizon = horizon or HORIZON.get(freq, 14)
    if len(ts) < 4:
        return pd.DataFrame(columns=["forecast", "lower", "upper"])

    m = SEASONAL_PERIODS.get(freq, 7)
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        use_seasonal = len(ts) >= 2 * m
        model = ExponentialSmoothing(
            ts["revenue"].astype(float),
            trend="add",
            seasonal="add" if use_seasonal else None,
            seasonal_periods=m if use_seasonal else None,
            initialization_method="estimated",
        )
        fit = model.fit()
        mean = fit.forecast(horizon).clip(lower=0)

        # Uncertainty band from in-sample residual std, widening with horizon.
        resid = ts["revenue"].astype(float) - fit.fittedvalues
        std = float(np.std(resid))
        steps = np.arange(1, horizon + 1)
        margin = 1.96 * std * np.sqrt(steps)
        out = pd.DataFrame(
            {
                "forecast": mean.to_numpy(),
                "lower": np.clip(mean.to_numpy() - margin, 0, None),
                "upper": mean.to_numpy() + margin,
            },
            index=mean.index,
        )
        out.index.name = "period"
        return out
    except Exception:
        # statsmodels missing or failed to converge -> linear fallback.
        return _linear_forecast(ts, horizon, freq)
