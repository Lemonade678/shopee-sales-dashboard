const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const currencyPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("en-US");

export const fmtMoney = (n: number) => currency.format(n || 0);
export const fmtMoneyPrecise = (n: number) => currencyPrecise.format(n || 0);
export const fmtCompactMoney = (n: number) => "฿" + compact.format(n || 0);
export const fmtInt = (n: number) => integer.format(n || 0);
export const fmtCompact = (n: number) => compact.format(n || 0);

export function fmtPct(n: number, withSign = true): string {
  if (!isFinite(n)) return "—";
  const sign = withSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
