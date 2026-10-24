import { useState, type FormEvent } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { availableCash, availableQty, type OrderType, type Side } from '../lib/trading';
import { formatMoney, formatPrice, formatQty, prettySymbol } from '../lib/format';

interface Props {
  symbols: string[];
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  prices: Record<string, number>;
}

type Message = { kind: 'ok' | 'error'; text: string };

const PERCENTS = [25, 50, 75, 100];

export default function OrderTicket({ symbols, symbol, onSymbolChange, prices }: Props) {
  const place = usePortfolioStore((s) => s.place);
  const portfolio = usePortfolioStore((s) => s.portfolio);

  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [qty, setQty] = useState('');
  const [limit, setLimit] = useState('');
  const [message, setMessage] = useState<Message | null>(null);

  const price = prices[symbol]; // may be undefined until the first tick arrives
  const qtyNum = Number(qty);
  const limitNum = Number(limit);
  const refPrice = type === 'limit' && limitNum > 0 ? limitNum : price;
  const estimate = qtyNum > 0 && refPrice ? qtyNum * refPrice : 0;
  const available = side === 'buy' ? availableCash(portfolio) : availableQty(portfolio, symbol);

  const fillPercent = (pct: number) => {
    if (side === 'sell') {
      setQty(String(Math.floor(((available * pct) / 100) * 1e6) / 1e6));
    } else if (refPrice) {
      setQty(String(Math.floor(((available * pct) / 100 / refPrice) * 1e6) / 1e6));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const outcome = place(
      { symbol, side, type, qty: qtyNum, limitPrice: type === 'limit' ? limitNum : undefined },
      price ?? NaN,
    );
    if (!outcome.ok) {
      setMessage({ kind: 'error', text: outcome.error });
      return;
    }
    setMessage({
      kind: 'ok',
      text: outcome.status === 'filled' ? 'Order filled' : 'Limit order placed and waiting to fill',
    });
    setQty('');
  };

  return (
    <section className="panel">
      <h2>Order ticket</h2>
      <form onSubmit={submit} className="ticket">
        <label>
          Symbol
          <select value={symbol} onChange={(e) => onSymbolChange(e.target.value)}>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {prettySymbol(s)}
              </option>
            ))}
          </select>
        </label>

        <div className="seg" role="group" aria-label="Side">
          <button type="button" className={side === 'buy' ? 'active buy' : ''} onClick={() => setSide('buy')}>
            Buy
          </button>
          <button type="button" className={side === 'sell' ? 'active sell' : ''} onClick={() => setSide('sell')}>
            Sell
          </button>
        </div>

        <div className="seg" role="group" aria-label="Order type">
          <button type="button" className={type === 'market' ? 'active' : ''} onClick={() => setType('market')}>
            Market
          </button>
          <button type="button" className={type === 'limit' ? 'active' : ''} onClick={() => setType('limit')}>
            Limit
          </button>
        </div>

        {type === 'limit' && (
          <label>
            Limit price (USDT)
            <div className="row">
              <input
                inputMode="decimal"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="0.00"
              />
              <button type="button" className="ghost" onClick={() => price && setLimit(String(price))}>
                Last
              </button>
            </div>
          </label>
        )}

        <label>
          Quantity
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00" />
        </label>

        <div className="pcts">
          {PERCENTS.map((p) => (
            <button key={p} type="button" className="ghost small" onClick={() => fillPercent(p)}>
              {p}%
            </button>
          ))}
        </div>

        <dl className="facts">
          <div>
            <dt>Last price</dt>
            <dd>{price ? formatPrice(price) : 'waiting...'}</dd>
          </div>
          <div>
            <dt>Estimated {side === 'buy' ? 'cost' : 'proceeds'}</dt>
            <dd>{formatMoney(estimate)}</dd>
          </div>
          <div>
            <dt>Available</dt>
            <dd>{side === 'buy' ? `${formatMoney(available)} USDT` : formatQty(available)}</dd>
          </div>
        </dl>

        <button type="submit" className={`submit ${side}`}>
          {side === 'buy' ? 'Buy' : 'Sell'} {prettySymbol(symbol).split('/')[0]}
        </button>

        {message && <p className={message.kind === 'error' ? 'msg error' : 'msg ok'}>{message.text}</p>}
      </form>
    </section>
  );
}
