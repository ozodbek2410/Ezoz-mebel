import { create } from "zustand";

interface UIState {
  mobileSidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const COLLAPSED_KEY = "ezoz-sidebar-collapsed";

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export const useUIStore = create<UIState>()((set) => ({
  mobileSidebarOpen: false,
  sidebarCollapsed: getInitialCollapsed(),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleSidebarCollapsed: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (collapsed) => {
    try { localStorage.setItem(COLLAPSED_KEY, String(collapsed)); } catch { /* ignore */ }
    set({ sidebarCollapsed: collapsed });
  },
}));
