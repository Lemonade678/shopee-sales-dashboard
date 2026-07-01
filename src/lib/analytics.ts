import type { ForecastPoint, Granularity, SeriesPoint } from "./types";

/** Trailing simple moving average over `window` buckets. */
export function movingAverage(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    out.push(sum / window);
  }
  return out;
}

/** Period-over-period growth: compares the last N buckets with the previous N. */
export function periodGrowth(values: number[], window: number): number {
  if (values.length < window * 2) return NaN;
  const recent = values.slice(-window).reduce((a, b) => a + b, 0);
  const prior = values.slice(-window * 2, -window).reduce((a, b) => a + b, 0);
  if (prior === 0) return NaN;
  return ((recent - prior) / prior) * 100;
}

/** Ordinary least squares slope/intercept over 0..n-1. */
function linearFit(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function addBucket(dateISO: string, granularity: Granularity, steps: number): string {
  const d = new Date(dateISO);
  if (granularity === "month") d.setMonth(d.getMonth() + steps);
  else if (granularity === "week") d.setDate(d.getDate() + steps * 7);
  else d.setDate(d.getDate() + steps);
  return d.toISOString().slice(0, 10);
}

/**
 * Forecast future revenue.
 *
 * Model: linear trend (OLS) + multiplicative weekday seasonality (only applied
 * for daily granularity, where Shopee traffic has a strong day-of-week pattern).
 * The uncertainty band is ±1.96 * residual std, widening with the horizon.
 */
export function forecastRevenue(
  series: SeriesPoint[],
  horizon: number,
  granularity: Granularity
): ForecastPoint[] {
  if (series.length < 4) return [];

  const revenue = series.map((p) => p.revenue);
  const { slope, intercept } = linearFit(revenue);
  const n = revenue.length;

  // Weekday seasonal factors (daily only).
  const seasonal = new Array(7).fill(1);
  if (granularity === "day") {
    const sums = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    let ratioTotal = 0;
    let ratioCount = 0;
    for (let i = 0; i < n; i++) {
      const trend = intercept + slope * i;
      if (trend <= 0) continue;
      const dow = new Date(series[i].bucket).getDay();
      const ratio = revenue[i] / trend;
      sums[dow] += ratio;
      counts[dow] += 1;
      ratioTotal += ratio;
      ratioCount += 1;
    }
    const globalMean = ratioCount > 0 ? ratioTotal / ratioCount : 1;
    for (let d = 0; d < 7; d++) {
      seasonal[d] = counts[d] > 0 ? sums[d] / counts[d] : globalMean;
    }
  }

  // Residual standard deviation (on the fitted history) for the band.
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const fitted = (intercept + slope * i) * (granularity === "day" ? seasonal[new Date(series[i].bucket).getDay()] : 1);
    sse += (revenue[i] - fitted) ** 2;
  }
  const resStd = Math.sqrt(sse / Math.max(1, n - 2));

  const lastBucket = series[series.length - 1].bucket;
  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = n - 1 + h;
    const bucket = addBucket(lastBucket, granularity, h);
    const dow = new Date(bucket).getDay();
    const factor = granularity === "day" ? seasonal[dow] : 1;
    const point = Math.max(0, (intercept + slope * idx) * factor);
    // band widens ~sqrt(h) with the forecast horizon
    const margin = 1.96 * resStd * Math.sqrt(h);
    out.push({
      bucket,
      forecast: point,
      lower: Math.max(0, point - margin),
      upper: point + margin,
    });
  }
  return out;
}
