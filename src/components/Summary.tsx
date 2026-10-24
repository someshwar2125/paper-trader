import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { equity, unrealizedPnl, availableCash } from '../lib/trading';
import { formatMoney, formatSignedMoney } from '../lib/format';

interface Props {
  prices: Record<string, number>;
}

export default function Summary({ prices }: Props) {
  const portfolio = usePortfolioStore((s) => s.portfolio);
  const reset = usePortfolioStore((s) => s.reset);

  const stats = useMemo(
    () => ({
      equity: equity(portfolio, prices),
      unrealized: unrealizedPnl(portfolio, prices),
      cash: availableCash(portfolio),
      realized: portfolio.realizedPnl,
    }),
    [portfolio, prices],
  );

  const cls = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

  return (
    <section className="summary">
      <div className="stat">
        <span className="label">Account value</span>
        <span className="value">{formatMoney(stats.equity)}</span>
      </div>
      <div className="stat">
        <span className="label">Available cash</span>
        <span className="value">{formatMoney(stats.cash)}</span>
      </div>
      <div className="stat">
        <span className="label">Unrealized P&amp;L</span>
        <span className={`value ${cls(stats.unrealized)}`}>{formatSignedMoney(stats.unrealized)}</span>
      </div>
      <div className="stat">
        <span className="label">Realized P&amp;L</span>
        <span className={`value ${cls(stats.realized)}`}>{formatSignedMoney(stats.realized)}</span>
      </div>
      <button
        className="ghost"
        onClick={() => {
          if (window.confirm('Reset your account to 100,000 USDT and clear all orders?')) reset();
        }}
      >
        Reset
      </button>
    </section>
  );
}
