import { useEffect, useMemo, useState } from 'react';
import MarketStrip from './components/MarketStrip';
import OrderTicket from './components/OrderTicket';
import Orders from './components/Orders';
import Positions from './components/Positions';
import Summary from './components/Summary';
import { useTickers } from './hooks/useTickers';
import { usePortfolioStore } from './store/portfolioStore';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

const STATUS_LABEL = { connecting: 'Connecting...', open: 'Live', reconnecting: 'Reconnecting...' } as const;

export default function App() {
  const { tickers, status } = useTickers(SYMBOLS);
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const tick = usePortfolioStore((s) => s.tick);

  // symbol -> last price. Recomputed only when tickers change.
  const prices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of Object.values(tickers)) map[t.symbol] = t.price;
    return map;
  }, [tickers]);

  // Every price update: let the store fill any resting limit orders that were crossed.
  useEffect(() => {
    tick(prices);
  }, [prices, tick]);

  return (
    <div className="app">
      <header>
        <h1>Paper Trader</h1>
        <span className={`status ${status}`}>
          <span className="dot" /> {STATUS_LABEL[status]}
        </span>
      </header>

      <Summary prices={prices} />
      <MarketStrip symbols={SYMBOLS} tickers={tickers} selected={symbol} onSelect={setSymbol} />

      <main>
        <OrderTicket symbols={SYMBOLS} symbol={symbol} onSymbolChange={setSymbol} prices={prices} />
        <div className="stack">
          <Positions prices={prices} />
          <Orders />
        </div>
      </main>

      <footer>Simulated trading with live Binance prices. No real money. Data is saved in your browser.</footer>
    </div>
  );
}
