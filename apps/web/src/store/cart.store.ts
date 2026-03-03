import { create } from "zustand";

export interface CartItem {
  productId: number | null;
  productName: string;
  productCode: string;
  categoryName: string;
  unit: string;
  serviceName: string | null;
  quantity: number;
  priceUzs: number;
  priceUsd: number;
  masterId: number | null;
}

interface AddProductInput {
  id: number;
  name: string;
  code: string;
  categoryName: string;
  unit: string;
  sellPriceUzs: number;
  sellPriceUsd: number;
}

interface CartStore {
  items: CartItem[];
  addProduct: (product: AddProductInput) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  updatePrice: (index: number, field: "priceUzs" | "priceUsd", value: number) => void;
  updateMaster: (index: number, masterId: number | null) => void;
  addService: (name: string, uzs: number, usd: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],

  addProduct: (product) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            categoryName: product.categoryName,
            unit: product.unit,
            serviceName: null,
            quantity: 1,
            priceUzs: product.sellPriceUzs,
            priceUsd: product.sellPriceUsd,
            masterId: null,
          },
        ],
      };
    }),

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  updateQuantity: (index, qty) =>
    set((state) => ({
      items: qty <= 0
        ? state.items.filter((_, i) => i !== index)
        : state.items.map((item, i) => (i === index ? { ...item, quantity: qty } : item)),
    })),

  updatePrice: (index, field, value) =>
    set((state) => ({
      items: state.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    })),

  updateMaster: (index, masterId) =>
    set((state) => ({
      items: state.items.map((item, i) => (i === index ? { ...item, masterId } : item)),
    })),

  addService: (name, uzs, usd) =>
    set((state) => {
      const existing = state.items.find((i) => i.serviceName === name);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.serviceName === name ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: null,
            productName: name,
            productCode: "",
            categoryName: "",
            unit: "",
            serviceName: name,
            quantity: 1,
            priceUzs: uzs,
            priceUsd: usd,
            masterId: null,
          },
        ],
      };
    }),

  clear: () => set({ items: [] }),
}));
