import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartItem {
  productId: number;
  name: string;
  image: string | null;
  priceUzs: number;
  quantity: number;
}

interface MarketplaceState {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (item) => {
        const { cart } = get();
        const existing = cart.find((c) => c.productId === item.productId);
        if (existing) {
          set({
            cart: cart.map((c) =>
              c.productId === item.productId
                ? { ...c, quantity: c.quantity + 1 }
                : c
            ),
          });
        } else {
          set({ cart: [...cart, { ...item, quantity: 1 }] });
        }
      },

      removeFromCart: (productId) => {
        set({ cart: get().cart.filter((c) => c.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }
        set({
          cart: get().cart.map((c) =>
            c.productId === productId ? { ...c, quantity } : c
          ),
        });
      },

      clearCart: () => set({ cart: [] }),

      getCartTotal: () => {
        return get().cart.reduce((sum, c) => sum + c.priceUzs * c.quantity, 0);
      },

      getCartCount: () => {
        return get().cart.reduce((sum, c) => sum + c.quantity, 0);
      },
    }),
    {
      name: "ezoz-marketplace-cart",
    }
  )
);
