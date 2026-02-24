import { create } from "zustand";

export type Locale = "latin" | "cyrillic";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem("ezoz-locale");
    if (stored === "cyrillic" || stored === "latin") return stored;
  } catch {}
  return "latin";
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    try { localStorage.setItem("ezoz-locale", locale); } catch {}
    set({ locale });
  },
  toggleLocale: () => {
    const next: Locale = get().locale === "latin" ? "cyrillic" : "latin";
    try { localStorage.setItem("ezoz-locale", next); } catch {}
    set({ locale: next });
  },
}));
