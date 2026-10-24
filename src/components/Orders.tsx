import { useState } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { formatPrice, formatQty, prettySymbol } from '../lib/format';
import type { Order } from '../lib/trading';

function time(ms: number | undefined): string {
  return ms ? new Date(ms).toLocaleTimeString() : '';
}

function OrderRow({ order, onCancel }: { order: Order; onCancel?: (id: string) => void }) {
  return (
    <tr>
      <td>{time(order.filledAt ?? order.createdAt)}</td>
      <td className="symbol">{prettySymbol(order.symbol)}</td>
      <td className={order.side === 'buy' ? 'up' : 'down'}>{order.side.toUpperCase()}</td>
      <td>{order.type}</td>
      <td className="num">{formatQty(order.qty)}</td>
      <td className="num">
        {order.status === 'filled'
          ? formatPrice(order.fillPrice as number)
          : order.limitPrice !== undefined
            ? formatPrice(order.limitPrice)
            : ''}
      </td>
      <td>
        {onCancel ? (
          <button className="ghost small" onClick={() => onCancel(order.id)}>
            Cancel
          </button>
        ) : (
          order.status
        )}
      </td>
    </tr>
  );
}

const HEAD = (
  <thead>
    <tr>
      <th>Time</th>
      <th>Symbol</th>
      <th>Side</th>
      <th>Type</th>
      <th className="num">Qty</th>
      <th className="num">Price</th>
      <th />
    </tr>
  </thead>
);

export default function Orders() {
  const orders = usePortfolioStore((s) => s.portfolio.orders);
  const cancel = usePortfolioStore((s) => s.cancel);
  const [tab, setTab] = useState<'open' | 'history'>('open');

  const open = orders.filter((o) => o.status === 'open');
  const history = orders.filter((o) => o.status !== 'open').slice(0, 25);
  const shown = tab === 'open' ? open : history;

  return (
    <section className="panel">
      <div className="tabs-head">
        <h2>Orders</h2>
        <div className="seg compact" role="tablist">
          <button role="tab" className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>
            Open ({open.length})
          </button>
          <button role="tab" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            History
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="muted">{tab === 'open' ? 'No open orders.' : 'No order history yet.'}</p>
      ) : (
        <table>
          {HEAD}
          <tbody>
            {shown.map((o) => (
              <OrderRow key={o.id} order={o} onCancel={tab === 'open' ? cancel : undefined} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
