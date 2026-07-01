# Python time-frame analytics — แมวกินเส้น

A pandas-based pipeline that turns a raw Shopee export into time-frame
aggregates (daily / weekly / monthly), moving averages, growth, and a
statsmodels **Holt-Winters forecast**. Same column mapping and forecast logic as
the web dashboard, so the numbers line up.

## Install

```bash
cd analytics
python -m venv .venv && .venv\Scripts\activate      # Windows
# source .venv/bin/activate                          # macOS/Linux
pip install -r requirements.txt
```

## Try it with sample data

```bash
python make_sample.py --out sample_orders.csv --days 180
python cli.py --input sample_orders.csv --freq D
```

## Analyse your real export

```bash
# Daily view + save a full JSON report and the resampled series as CSV
python cli.py --input "Order.all.20260701.xlsx" --freq D --out report.json --series series.csv

# Weekly, forecast 8 weeks ahead
python cli.py --input orders.csv --freq W --horizon 8
```

Flags:

| Flag              | Meaning                                       |
| ----------------- | --------------------------------------------- |
| `--freq D\|W\|M`  | time frame (daily / weekly / monthly)         |
| `--horizon N`     | number of periods to forecast                 |
| `--out file.json` | write the full report (summary, series, forecast, top products, categories) |
| `--series f.csv`  | write just the resampled time series          |

## Load straight into Supabase (optional)

An alternative to the web Import page — good for scheduled/batch jobs:

```bash
pip install supabase python-dotenv
python load_to_supabase.py --input orders.csv --shop "แมวกินเส้น"
```

Reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
project's `.env.local`.

## Files

| File                  | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `loader.py`           | read CSV/Excel → tidy sales-line DataFrame          |
| `shopee_columns.py`   | Shopee header aliases (EN + TH)                     |
| `timeframe.py`        | resample to time frames, moving average, growth     |
| `forecast.py`         | Holt-Winters forecast (linear fallback)             |
| `cli.py`              | command-line entry point                            |
| `load_to_supabase.py` | optional bulk loader into Supabase                  |
| `make_sample.py`      | generate a Shopee-style test export                 |
