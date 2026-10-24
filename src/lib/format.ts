/** Price with sensible precision: big prices get 2 decimals, tiny ones more. */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '-';
  let digits = 2;
  if (value < 1) digits = 6;
  else if (value < 100) digits = 4;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Money with 2 decimals, e.g. 12,345.60 */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Money with an explicit sign, e.g. +120.50 / -33.10 */
export function formatSignedMoney(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return sign + formatMoney(value);
}

/** Percent with an explicit sign, e.g. +1.23% / -0.40% */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Quantity up to 6 decimals with trailing zeros trimmed. */
export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return Number(value.toFixed(6)).toString();
}

/** "BTCUSDT" -> "BTC/USDT" */
export function prettySymbol(symbol: string): string {
  return symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}/USDT` : symbol;
}
