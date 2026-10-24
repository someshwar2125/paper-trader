# Paper Trader

A paper-trading app with **live Binance prices**: place market and limit orders, track positions and P&L, and watch resting limit orders fill when the price crosses. Built with **React, TypeScript, Zustand and WebSockets**. No real money, no API keys.

**Live demo:** https://paper-trader-eight-tau.vercel.app/

## Features

- Live prices for 5 symbols over one WebSocket, with a connection status indicator and auto-reconnect
- Order ticket: buy/sell, market/limit, quantity shortcuts (25/50/75/100%), estimated cost, validation messages
- Limit orders that rest until the live price crosses them, then fill automatically
- Cash and quantity **reservation**: open buy orders reserve cash and open sell orders reserve coins, so you cannot spend or sell the same thing twice
- Positions table with average entry price, market value, unrealized P&L (amount and %), and a one-click Close
- Order history, open orders with Cancel, realized P&L, account value
- State saved in `localStorage` (Zustand `persist`), so a refresh keeps your account
- Responsive layout, strict TypeScript, unit tests for the trading rules

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (trading engine + formatting + parsing)
npm run build      # production build
npm run typecheck  # strict TypeScript check
```

## How it is organised

```
src/
  lib/
    trading.ts        pure trading engine (validate, place, match, cancel, P&L) - no React, no network
    trading.test.ts   the rules, tested
    binance.ts        ticker parsing + stream URL
    socket.ts         reconnecting WebSocket wrapper
    format.ts         money / price / percent formatting
  store/
    portfolioStore.ts Zustand store: thin layer that calls the engine and persists the result
  hooks/
    useTickers.ts     live prices over one combined WebSocket
  components/
    Summary, MarketStrip, OrderTicket, Positions, Orders
  App.tsx             wires prices into the store (tick) and lays out the page
```

## Key design decisions (good interview material)

1. **Business rules live in a pure module.** `trading.ts` takes a portfolio and returns a *new* portfolio. No clock, no randomness, no React. That is why it can be unit tested exhaustively with no mocks.
2. **The store is a thin shell.** It supplies the impure bits (`Date.now()`, a random id, persistence) and delegates the rules to the engine.
3. **Reserved cash and quantity.** A resting buy limit order reserves `qty x limit` in cash; a resting sell reserves coins. Without this you could place ten orders that together cost more than you own.
4. **No pointless re-renders.** `tick()` returns early (no state change) when nothing filled. Components subscribe to *slices* of the store with selectors. The position rows are `React.memo`'d and their `onClose` handler is stable (`useCallback` + a ref for the latest prices), so a row only re-renders when its own price changes.
5. **Fill price.** A marketable limit order fills at the current market price (price improvement), not at the limit. A resting order fills at the price seen when it is first crossed.
6. **Long-only on purpose.** No short selling or leverage, to keep the rules simple and correct.

## Learn it by changing it

1. Add a **stop-loss** order type: sell when price falls to a trigger. Start in `trading.ts` (`OrderType`, `isMarketable`), add tests first.
2. Add **trading fees** (for example 0.1%) in `applyFill`, then update the tests.
3. Add a **component test** for `OrderTicket` with React Testing Library (type a quantity, click Buy, assert the message). You will need `@testing-library/react` and `jsdom`.
4. Show a small **P&L sparkline** per position.
5. Add an **equity curve**: record account value every few seconds and draw it.

## Resume bullets

- Built a paper-trading app (React, TypeScript, Zustand) streaming live prices over WebSockets, with market and limit orders, positions, real-time P&L and persistent state.
- Designed a pure, unit-tested trading engine (order validation, cash/quantity reservation, limit-order matching, P&L) separate from the UI, with 28 tests.
- Optimised renders with store selectors, stable callbacks and memoised rows; auto-reconnecting WebSocket with exponential backoff.

## Notes

- If Binance hosts are blocked on your network, change `WS_BASE` in `src/lib/binance.ts` to `wss://stream.binance.com:9443`.
- This is a simulation for learning. Prices are real; orders are not.
