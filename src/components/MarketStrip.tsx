import { memo } from 'react';
import type { Ticker } from '../lib/binance';
import { formatPercent, formatPrice, prettySymbol } from '../lib/format';

interface TileProps {
  symbol: string;
  ticker?: Ticker;
  selected: boolean;
  onSelect: (symbol: string) => void;
}

const Tile = memo(function Tile({ symbol, ticker, selected, onSelect }: TileProps) {
  return (
    <button className={`tile ${selected ? 'selected' : ''}`} onClick={() => onSelect(symbol)}>
      <span className="tile-symbol">{prettySymbol(symbol)}</span>
      <span className="tile-price">{ticker ? formatPrice(ticker.price) : '...'}</span>
      <span className={ticker ? (ticker.changePct >= 0 ? 'up' : 'down') : ''}>
        {ticker ? formatPercent(ticker.changePct) : ''}
      </span>
    </button>
  );
});

interface Props {
  symbols: string[];
  tickers: Record<string, Ticker>;
  selected: string;
  onSelect: (symbol: string) => void;
}

export default function MarketStrip({ symbols, tickers, selected, onSelect }: Props) {
  return (
    <section className="strip">
      {symbols.map((s) => (
        <Tile key={s} symbol={s} ticker={tickers[s]} selected={s === selected} onSelect={onSelect} />
      ))}
    </section>
  );
}
