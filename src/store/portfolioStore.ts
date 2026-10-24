import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  cancelOrder,
  createPortfolio,
  matchOpenOrders,
  placeOrder,
  type OrderInput,
  type OrderStatus,
  type Portfolio,
} from '../lib/trading';

export type PlaceOutcome = { ok: true; status: OrderStatus } | { ok: false; error: string };

interface PortfolioState {
  portfolio: Portfolio;
  /** Validate and place an order at the given market price. */
  place: (input: OrderInput, marketPrice: number) => PlaceOutcome;
  cancel: (id: string) => void;
  /** Call on every price update: fills resting limit orders that were crossed. */
  tick: (prices: Record<string, number>) => void;
  reset: () => void;
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      portfolio: createPortfolio(),

      place: (input, marketPrice) => {
        const result = placeOrder(get().portfolio, input, marketPrice, Date.now(), newId());
        if (!result.ok) return { ok: false, error: result.error };
        set({ portfolio: result.portfolio });
        return { ok: true, status: result.order.status };
      },

      cancel: (id) => set((s) => ({ portfolio: cancelOrder(s.portfolio, id) })),

      tick: (prices) => {
        const current = get().portfolio;
        const next = matchOpenOrders(current, prices, Date.now());
        if (next !== current) set({ portfolio: next }); // only update when something filled
      },

      reset: () => set({ portfolio: createPortfolio() }),
    }),
    {
      name: 'paper-trader:v1', // localStorage key
      partialize: (s) => ({ portfolio: s.portfolio }),
    },
  ),
);
