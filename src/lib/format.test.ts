import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, formatPrice, formatQty, formatSignedMoney, prettySymbol } from './format';
import { parseMiniTicker, tickerStreamUrl } from './binance';

describe('format', () => {
  it('formats prices by magnitude', () => {
    expect(formatPrice(67123.456)).toBe('67,123.46');
    expect(formatPrice(12.34567)).toBe('12.3457');
    expect(formatPrice(0.123456789)).toBe('0.123457');
    expect(formatPrice(NaN)).toBe('-');
  });

  it('formats money with and without a sign', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50');
    expect(formatSignedMoney(20)).toBe('+20.00');
    expect(formatSignedMoney(-3.1)).toBe('-3.10');
  });

  it('formats percent and quantity', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-0.4)).toBe('-0.40%');
    expect(formatQty(1.5)).toBe('1.5');
    expect(formatQty(0.12345678)).toBe('0.123457');
  });

  it('prettifies symbols', () => {
    expect(prettySymbol('BTCUSDT')).toBe('BTC/USDT');
    expect(prettySymbol('ETHBTC')).toBe('ETHBTC');
  });
});

describe('binance parsing', () => {
  it('parses a mini ticker', () => {
    const t = parseMiniTicker({ s: 'BTCUSDT', c: '110', o: '100' });
    expect(t).toMatchObject({ symbol: 'BTCUSDT', price: 110, open: 100 });
    expect(t?.changePct).toBeCloseTo(10);
  });

  it('rejects malformed tickers', () => {
    expect(parseMiniTicker(null)).toBeNull();
    expect(parseMiniTicker({ s: 'X', c: 'abc', o: '1' })).toBeNull();
    expect(parseMiniTicker({ s: 'X', c: '1', o: '0' })).toBeNull();
  });

  it('builds the combined stream url', () => {
    expect(tickerStreamUrl(['BTCUSDT', 'ETHUSDT'])).toContain('streams=btcusdt@miniTicker/ethusdt@miniTicker');
  });
});
