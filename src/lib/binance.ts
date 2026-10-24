/** Binance public market-data (no API key). Swap hosts here if blocked on your network. */
export const WS_BASE = 'wss://data-stream.binance.vision';

export interface Ticker {
  symbol: string; // e.g. "BTCUSDT"
  price: number;
  open: number;
  changePct: number;
}

type Rec = Record<string, unknown>;

/** Parse a 24h mini-ticker payload. Returns null if the payload is malformed. */
export function parseMiniTicker(data: unknown): Ticker | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Rec;
  if (typeof d.s !== 'string') return null;

  const price = Number(d.c);
  const open = Number(d.o);
  if (!Number.isFinite(price) || !Number.isFinite(open) || open === 0) return null;

  return { symbol: d.s, price, open, changePct: ((price - open) / open) * 100 };
}

export function tickerStreamUrl(symbols: string[]): string {
  const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
  return `${WS_BASE}/stream?streams=${streams}`;
}
