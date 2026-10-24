import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { positionMetrics, type Position } from '../lib/trading';
import { formatMoney, formatPercent, formatPrice, formatQty, formatSignedMoney, prettySymbol } from '../lib/format';

interface RowProps {
  position: Position;
  price: number | undefined;
  onClose: (symbol: string) => void;
}

// memo: a row re-renders only if ITS position or ITS price changed.
// This works because onClose is stable (useCallback below) and the other props are values/stable refs.
const Row = memo(function Row({ position, price, onClose }: RowProps) {
  const m = price !== undefined ? positionMetrics(position, price) : null;
  const cls = m ? (m.pnl > 0 ? 'up' : m.pnl < 0 ? 'down' : '') : '';
  return (
    <tr>
      <td className="symbol">{prettySymbol(position.symbol)}</td>
      <td className="num">{formatQty(position.qty)}</td>
      <td className="num">{formatPrice(position.avgPrice)}</td>
      <td className="num">{price !== undefined ? formatPrice(price) : '...'}</td>
      <td className="num hide-sm">{m ? formatMoney(m.marketValue) : ''}</td>
      <td className={`num ${cls}`}>
        {m ? `${formatSignedMoney(m.pnl)} (${formatPercent(m.pnlPct)})` : ''}
      </td>
      <td>
        <button className="ghost small" onClick={() => onClose(position.symbol)}>
          Close
        </button>
      </td>
    </tr>
  );
});

interface Props {
  prices: Record<string, number>;
}

export default function Positions({ prices }: Props) {
  const positions = usePortfolioStore((s) => s.portfolio.positions);
  const place = usePortfolioStore((s) => s.place);
  const [error, setError] = useState('');

  // Keep the latest prices in a ref so handleClose can stay stable (and Row's memo keeps working).
  const pricesRef = useRef(prices);
  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  const handleClose = useCallback(
    (symbol: string) => {
      const pos = usePortfolioStore.getState().portfolio.positions[symbol];
      if (!pos) return;
      const outcome = place(
        { symbol, side: 'sell', type: 'market', qty: pos.qty },
        pricesRef.current[symbol] ?? NaN,
      );
      setError(outcome.ok ? '' : `${prettySymbol(symbol)}: ${outcome.error}. Cancel open sell orders first.`);
    },
    [place],
  );

  const list = Object.values(positions);

  return (
    <section className="panel">
      <h2>Positions</h2>
      {error && <p className="msg error">{error}</p>}
      {list.length === 0 ? (
        <p className="muted">No open positions. Place a buy order to get started.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="num">Qty</th>
              <th className="num">Avg price</th>
              <th className="num">Last</th>
              <th className="num hide-sm">Value</th>
              <th className="num">P&amp;L</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <Row key={p.symbol} position={p} price={prices[p.symbol]} onClose={handleClose} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
