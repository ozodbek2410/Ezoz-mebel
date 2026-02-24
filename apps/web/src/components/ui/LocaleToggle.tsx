import { useLocaleStore } from "@/store/locale.store";

interface LocaleToggleProps {
  collapsed?: boolean;
}

export function LocaleToggle({ collapsed }: LocaleToggleProps) {
  const { locale, toggleLocale } = useLocaleStore();
  const isCyrillic = locale === "cyrillic";

  return (
    <button
      onClick={toggleLocale}
      title={isCyrillic ? "Lotinchaga o'tish" : "Kirillga o'tish"}
      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 select-none"
    >
      <span className={isCyrillic ? "text-brand-600" : "text-gray-400"}>Ўз</span>
      <span className="text-gray-300">/</span>
      <span className={!isCyrillic ? "text-brand-600" : "text-gray-400"}>Uz</span>
      {!collapsed && <span className="ml-1 text-gray-400 text-[10px]">{isCyrillic ? "Кирилл" : "Lotin"}</span>}
    </button>
  );
}
