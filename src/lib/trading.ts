/**
 * Pure trading engine. No React, no network, no clock: everything is a function of
 * (portfolio, input) -> new portfolio. That makes the rules easy to unit test.
 *
 * Rules (long-only paper trading):
 * - Market orders fill immediately at the current price.
 * - Limit orders fill immediately if "marketable" (buy limit >= price, sell limit <= price),
 *   otherwise they rest as open orders and fill later when price crosses.
 * - Open buy orders reserve cash (qty * limit); open sell orders reserve quantity.
 *   This stops you spending the same money (or selling the same coins) twice.
 */

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'open' | 'filled' | 'cancelled';

export interface Order {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  limitPrice?: number;
  status: OrderStatus;
  createdAt: number;
  filledAt?: number;
  fillPrice?: number;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface Portfolio {
  cash: number;
  realizedPnl: number;
  positions: Record<string, Position>;
  orders: Order[]; // newest first
}

export interface OrderInput {
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  limitPrice?: number;
}

export type PlaceResult =
  | { ok: true; portfolio: Portfolio; order: Order }
  | { ok: false; error: string };

export const START_CASH = 100_000;
const EPS = 1e-9;

export function createPortfolio(cash: number = START_CASH): Portfolio {
  return { cash, realizedPnl: 0, positions: {}, orders: [] };
}

export function reservedCash(p: Portfolio): number {
  return p.orders
    .filter((o) => o.status === 'open' && o.side === 'buy')
    .reduce((sum, o) => sum + o.qty * (o.limitPrice ?? 0), 0);
}

export function reservedQty(p: Portfolio, symbol: string): number {
  return p.orders
    .filter((o) => o.status === 'open' && o.side === 'sell' && o.symbol === symbol)
    .reduce((sum, o) => sum + o.qty, 0);
}

export function availableCash(p: Portfolio): number {
  return p.cash - reservedCash(p);
}

export function availableQty(p: Portfolio, symbol: string): number {
  return (p.positions[symbol]?.qty ?? 0) - reservedQty(p, symbol);
}

/** Returns an error message, or null if the order is valid. */
export function validateOrder(p: Portfolio, input: OrderInput, marketPrice: number): string | null {
  if (!Number.isFinite(input.qty) || input.qty <= 0) return 'Quantity must be greater than 0';
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return 'Waiting for a live price';

  if (input.type === 'limit') {
    if (input.limitPrice === undefined || !Number.isFinite(input.limitPrice) || input.limitPrice <= 0) {
      return 'Enter a valid limit price';
    }
  }

  if (input.side === 'buy') {
    const price = input.type === 'limit' ? (input.limitPrice as number) : marketPrice;
    const cost = input.qty * price;
    if (cost > availableCash(p) + EPS) return 'Not enough available cash';
  } else if (input.qty > availableQty(p, input.symbol) + EPS) {
    return 'Not enough available quantity to sell';
  }
  return null;
}

export function isMarketable(order: Pick<Order, 'side' | 'type' | 'limitPrice'>, price: number): boolean {
  if (order.type === 'market') return true;
  const limit = order.limitPrice as number;
  return order.side === 'buy' ? limit >= price : limit <= price;
}

function upsertOrder(orders: Order[], order: Order): Order[] {
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx === -1) return [order, ...orders];
  const copy = orders.slice();
  copy[idx] = order;
  return copy;
}

function applyFill(p: Portfolio, order: Order, price: number, now: number): Portfolio {
  const filled: Order = { ...order, status: 'filled', filledAt: now, fillPrice: price };
  const orders = upsertOrder(p.orders, filled);
  const pos = p.positions[order.symbol];

  if (order.side === 'buy') {
    const oldQty = pos?.qty ?? 0;
    const oldAvg = pos?.avgPrice ?? 0;
    const newQty = oldQty + order.qty;
    const avgPrice = (oldQty * oldAvg + order.qty * price) / newQty;
    return {
      ...p,
      cash: p.cash - order.qty * price,
      orders,
      positions: { ...p.positions, [order.symbol]: { symbol: order.symbol, qty: newQty, avgPrice } },
    };
  }

  const oldQty = pos?.qty ?? 0;
  const avg = pos?.avgPrice ?? 0;
  const remaining = oldQty - order.qty;
  const positions = { ...p.positions };
  if (remaining <= EPS) delete positions[order.symbol];
  else positions[order.symbol] = { symbol: order.symbol, qty: remaining, avgPrice: avg };

  return {
    ...p,
    cash: p.cash + order.qty * price,
    realizedPnl: p.realizedPnl + (price - avg) * order.qty,
    orders,
    positions,
  };
}

export function placeOrder(
  p: Portfolio,
  input: OrderInput,
  marketPrice: number,
  now: number,
  id: string,
): PlaceResult {
  const error = validateOrder(p, input, marketPrice);
  if (error) return { ok: false, error };

  const order: Order = {
    id,
    symbol: input.symbol,
    side: input.side,
    type: input.type,
    qty: input.qty,
    limitPrice: input.type === 'limit' ? input.limitPrice : undefined,
    status: 'open',
    createdAt: now,
  };

  if (isMarketable(order, marketPrice)) {
    const portfolio = applyFill(p, order, marketPrice, now);
    return { ok: true, portfolio, order: portfolio.orders.find((o) => o.id === id) as Order };
  }
  return { ok: true, portfolio: { ...p, orders: [order, ...p.orders] }, order };
}

/**
 * Fill any open limit orders that the latest prices have crossed.
 * Returns the SAME portfolio object when nothing filled, so callers can skip state updates.
 */
export function matchOpenOrders(p: Portfolio, prices: Record<string, number>, now: number): Portfolio {
  const open = p.orders.filter((o) => o.status === 'open').sort((a, b) => a.createdAt - b.createdAt);
  let next = p;
  for (const order of open) {
    const price = prices[order.symbol];
    if (price === undefined || !Number.isFinite(price)) continue;
    if (isMarketable(order, price)) next = applyFill(next, order, price, now);
  }
  return next;
}

export function cancelOrder(p: Portfolio, id: string): Portfolio {
  const order = p.orders.find((o) => o.id === id);
  if (!order || order.status !== 'open') return p;
  return { ...p, orders: upsertOrder(p.orders, { ...order, status: 'cancelled' }) };
}

export interface PositionMetrics {
  marketValue: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
}

export function positionMetrics(pos: Position, price: number): PositionMetrics {
  const marketValue = pos.qty * price;
  const costBasis = pos.qty * pos.avgPrice;
  const pnl = marketValue - costBasis;
  return { marketValue, costBasis, pnl, pnlPct: costBasis === 0 ? 0 : (pnl / costBasis) * 100 };
}

/** Total account value: cash plus all positions marked at the latest price (or cost if no price yet). */
export function equity(p: Portfolio, prices: Record<string, number>): number {
  return Object.values(p.positions).reduce((sum, pos) => {
    const price = prices[pos.symbol];
    return sum + pos.qty * (price !== undefined && Number.isFinite(price) ? price : pos.avgPrice);
  }, p.cash);
}

export function unrealizedPnl(p: Portfolio, prices: Record<string, number>): number {
  return Object.values(p.positions).reduce((sum, pos) => {
    const price = prices[pos.symbol];
    return sum + (price !== undefined && Number.isFinite(price) ? positionMetrics(pos, price).pnl : 0);
  }, 0);
}
