import { useCallback } from "react";
import { latinToCyrillic } from "@/lib/latin-to-cyrillic";
import { useLocaleStore } from "@/store/locale.store";

// Use inside React components
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback(
    (text: string) => (locale === "cyrillic" ? latinToCyrillic(text) : text),
    [locale],
  );
}

// Use outside React (toast messages, etc.)
export function getT() {
  const { locale } = useLocaleStore.getState();
  return (text: string) => (locale === "cyrillic" ? latinToCyrillic(text) : text);
}
