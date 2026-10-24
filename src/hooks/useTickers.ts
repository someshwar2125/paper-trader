import { useEffect, useState } from 'react';
import { parseMiniTicker, tickerStreamUrl, type Ticker } from '../lib/binance';
import { createSocket, type ConnectionStatus } from '../lib/socket';

/** Live 24h mini-tickers for the given symbols over one combined WebSocket. */
export function useTickers(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  // Re-subscribe only when the *set* of symbols changes (a string compares by value).
  const key = symbols.join(',');

  useEffect(() => {
    if (symbols.length === 0) return;
    const stop = createSocket(tickerStreamUrl(symbols), {
      onStatus: setStatus,
      onMessage: (msg) => {
        const payload = (msg as { data?: unknown }).data ?? msg; // combined streams wrap as { stream, data }
        const ticker = parseMiniTicker(payload);
        if (ticker) setTickers((prev) => ({ ...prev, [ticker.symbol]: ticker }));
      },
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { tickers, status };
}
