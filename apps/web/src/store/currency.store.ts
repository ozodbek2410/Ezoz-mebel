import { create } from "zustand";
import { trpc } from "@/lib/trpc";

interface CurrencyState {
  rate: number | null;
  isLoading: boolean;
  setRate: (rate: number) => void;
  loadRate: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>()((set, get) => ({
  rate: null,
  isLoading: false,
  setRate: (rate) => set({ rate }),
  loadRate: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      // Use DB rate first (respects manual overrides)
      const dbRate = await trpc.currency.getToday.query();
      if (dbRate) {
        set({ rate: dbRate, isLoading: false });
        return;
      }
      // No DB rate for today — fetch from CBU and save it
      const cbuRate = await trpc.currency.fetchCbuRate.query();
      if (cbuRate) {
        set({ rate: cbuRate, isLoading: false });
        return;
      }
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
