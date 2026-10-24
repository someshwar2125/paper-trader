import { describe, expect, it } from 'vitest';
import {
  availableCash,
  availableQty,
  cancelOrder,
  createPortfolio,
  equity,
  matchOpenOrders,
  placeOrder,
  positionMetrics,
  unrealizedPnl,
  validateOrder,
  type OrderInput,
  type Portfolio,
} from './trading';

const BTC = 'BTCUSDT';
const buy = (qty: number, extra: Partial<OrderInput> = {}): OrderInput => ({
  symbol: BTC, side: 'buy', type: 'market', qty, ...extra,
});
const sell = (qty: number, extra: Partial<OrderInput> = {}): OrderInput => ({
  symbol: BTC, side: 'sell', type: 'market', qty, ...extra,
});

function mustPlace(p: Portfolio, input: OrderInput, price: number, id = 'o1', now = 1000): Portfolio {
  const r = placeOrder(p, input, price, now, id);
  if (!r.ok) throw new Error(r.error);
  return r.portfolio;
}

describe('validateOrder', () => {
  const p = createPortfolio(1000);

  it('rejects zero, negative and NaN quantity', () => {
    expect(validateOrder(p, buy(0), 100)).toMatch(/greater than 0/);
    expect(validateOrder(p, buy(-1), 100)).toMatch(/greater than 0/);
    expect(validateOrder(p, buy(NaN), 100)).toMatch(/greater than 0/);
  });

  it('needs a live price', () => {
    expect(validateOrder(p, buy(1), NaN)).toMatch(/live price/);
  });

  it('needs a valid limit price for limit orders', () => {
    expect(validateOrder(p, buy(1, { type: 'limit' }), 100)).toMatch(/limit price/);
    expect(validateOrder(p, buy(1, { type: 'limit', limitPrice: 0 }), 100)).toMatch(/limit price/);
  });

  it('rejects buying more than available cash', () => {
    expect(validateOrder(p, buy(11), 100)).toMatch(/cash/);
    expect(validateOrder(p, buy(10), 100)).toBeNull();
  });

  it('rejects selling what you do not own', () => {
    expect(validateOrder(p, sell(1), 100)).toMatch(/quantity/);
  });
});

describe('market orders', () => {
  it('buy reduces cash and creates a position', () => {
    const p = mustPlace(createPortfolio(1000), buy(2), 100);
    expect(p.cash).toBe(800);
    expect(p.positions[BTC]).toEqual({ symbol: BTC, qty: 2, avgPrice: 100 });
    expect(p.orders[0]).toMatchObject({ status: 'filled', fillPrice: 100 });
  });

  it('averages the entry price across buys', () => {
    let p = mustPlace(createPortfolio(10_000), buy(1), 100, 'a');
    p = mustPlace(p, buy(3), 200, 'b');
    expect(p.positions[BTC].qty).toBe(4);
    expect(p.positions[BTC].avgPrice).toBeCloseTo(175); // (1*100 + 3*200) / 4
  });

  it('partial sell realises P&L and keeps the average price', () => {
    let p = mustPlace(createPortfolio(10_000), buy(4), 100, 'a');
    p = mustPlace(p, sell(1), 150, 'b');
    expect(p.realizedPnl).toBeCloseTo(50);
    expect(p.positions[BTC].qty).toBe(3);
    expect(p.positions[BTC].avgPrice).toBe(100);
    expect(p.cash).toBeCloseTo(10_000 - 400 + 150);
  });

  it('selling everything removes the position', () => {
    let p = mustPlace(createPortfolio(10_000), buy(2), 100, 'a');
    p = mustPlace(p, sell(2), 90, 'b');
    expect(p.positions[BTC]).toBeUndefined();
    expect(p.realizedPnl).toBeCloseTo(-20);
  });

  it('does not mutate the previous portfolio', () => {
    const start = createPortfolio(1000);
    mustPlace(start, buy(1), 100);
    expect(start.cash).toBe(1000);
    expect(start.orders).toHaveLength(0);
  });
});

describe('limit orders', () => {
  it('a buy limit below the market rests as an open order', () => {
    const p = mustPlace(createPortfolio(1000), buy(1, { type: 'limit', limitPrice: 90 }), 100);
    expect(p.orders[0].status).toBe('open');
    expect(p.cash).toBe(1000); // cash is reserved, not spent
    expect(availableCash(p)).toBe(910);
  });

  it('a marketable buy limit fills at the market price', () => {
    const p = mustPlace(createPortfolio(1000), buy(1, { type: 'limit', limitPrice: 120 }), 100);
    expect(p.orders[0]).toMatchObject({ status: 'filled', fillPrice: 100 });
    expect(p.cash).toBe(900);
  });

  it('fills a resting buy when price falls to the limit', () => {
    let p = mustPlace(createPortfolio(1000), buy(1, { type: 'limit', limitPrice: 90 }), 100);
    expect(matchOpenOrders(p, { [BTC]: 95 }, 2000)).toBe(p); // nothing happens: same object back
    p = matchOpenOrders(p, { [BTC]: 89 }, 2000);
    expect(p.orders[0]).toMatchObject({ status: 'filled', fillPrice: 89, filledAt: 2000 });
    expect(p.cash).toBe(911);
    expect(p.positions[BTC].qty).toBe(1);
  });

  it('fills a resting sell when price rises to the limit', () => {
    let p = mustPlace(createPortfolio(1000), buy(1), 100, 'a');
    p = mustPlace(p, sell(1, { type: 'limit', limitPrice: 120 }), 100, 'b');
    expect(p.orders[0].status).toBe('open');
    p = matchOpenOrders(p, { [BTC]: 121 }, 3000);
    expect(p.orders[0].status).toBe('filled');
    expect(p.realizedPnl).toBeCloseTo(21);
    expect(p.positions[BTC]).toBeUndefined();
  });

  it('reserved cash stops you spending the same money twice', () => {
    const p = mustPlace(createPortfolio(1000), buy(9, { type: 'limit', limitPrice: 100 }), 150, 'a');
    expect(validateOrder(p, buy(2), 100)).toMatch(/cash/); // only 100 USDT left unreserved
  });

  it('reserved quantity stops you selling the same coins twice', () => {
    let p = mustPlace(createPortfolio(10_000), buy(2), 100, 'a');
    p = mustPlace(p, sell(2, { type: 'limit', limitPrice: 200 }), 100, 'b');
    expect(availableQty(p, BTC)).toBe(0);
    expect(validateOrder(p, sell(1), 100)).toMatch(/quantity/);
  });

  it('cancelling releases the reservation', () => {
    let p = mustPlace(createPortfolio(1000), buy(5, { type: 'limit', limitPrice: 100 }), 150, 'a');
    expect(availableCash(p)).toBe(500);
    p = cancelOrder(p, 'a');
    expect(p.orders[0].status).toBe('cancelled');
    expect(availableCash(p)).toBe(1000);
  });

  it('cancelling a filled or unknown order changes nothing', () => {
    const p = mustPlace(createPortfolio(1000), buy(1), 100, 'a');
    expect(cancelOrder(p, 'a')).toBe(p);
    expect(cancelOrder(p, 'nope')).toBe(p);
  });
});

describe('metrics', () => {
  it('computes position P&L', () => {
    const m = positionMetrics({ symbol: BTC, qty: 2, avgPrice: 100 }, 110);
    expect(m.marketValue).toBe(220);
    expect(m.costBasis).toBe(200);
    expect(m.pnl).toBe(20);
    expect(m.pnlPct).toBeCloseTo(10);
  });

  it('computes equity and unrealised P&L from live prices', () => {
    const p = mustPlace(createPortfolio(1000), buy(2), 100);
    expect(equity(p, { [BTC]: 110 })).toBeCloseTo(1020);
    expect(unrealizedPnl(p, { [BTC]: 110 })).toBeCloseTo(20);
  });

  it('falls back to cost when no price is known yet', () => {
    const p = mustPlace(createPortfolio(1000), buy(2), 100);
    expect(equity(p, {})).toBeCloseTo(1000);
    expect(unrealizedPnl(p, {})).toBe(0);
  });
});
