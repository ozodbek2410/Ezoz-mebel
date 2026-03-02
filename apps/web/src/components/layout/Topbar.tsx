import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/store/ui.store";
import { useCurrencyStore } from "@/store/currency.store";
import { UserRoleLabels, type UserRole } from "@ezoz/shared";
import { useT } from "@/hooks/useT";
import { useLocaleStore } from "@/store/locale.store";
import { useRouter } from "@tanstack/react-router";
import {
  Menu,
  Maximize,
  Minimize,
  Bell,
  ChevronDown,
  LogOut,
  Edit2,
} from "lucide-react";

interface TopbarProps {
  onEditProfile: () => void;
}

export function Topbar({ onEditProfile }: TopbarProps) {
  const t = useT();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toggleMobileSidebar, sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { rate } = useCurrencyStore();
  const { locale, toggleLocale } = useLocaleStore();
  const isCyrillic = locale === "cyrillic";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  if (!user) return null;

  return (
    <header className="topbar">
      {/* Left: hamburger + brand */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={20} />
        </button>
        {/* Desktop sidebar toggle */}
        <button
          onClick={toggleSidebarCollapsed}
          className="hidden lg:flex p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={20} />
        </button>

        {/* Currency rate */}
        {rate && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-slate-500">$</span>
            <span className="text-white font-medium">{rate.toLocaleString()}</span>
            <span>{t("so'm")}</span>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="hidden sm:flex p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={isFullscreen ? t("Kichraytirish") : t("To'liq ekran")}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLocale}
          className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={isCyrillic ? "Lotinchaga o'tish" : "Kirillga o'tish"}
        >
          <span className={`text-xs font-semibold ${isCyrillic ? "text-slate-500" : "text-white"}`}>Uz</span>
          <span className="text-slate-600">/</span>
          <span className={`text-xs font-semibold ${isCyrillic ? "text-white" : "text-slate-500"}`}>Ўз</span>
        </button>

        {/* Notification bell */}
        <button className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors relative">
          <Bell size={18} />
        </button>

        {/* Avatar dropdown */}
        <div ref={avatarRef} className="relative ml-1">
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-white truncate max-w-[120px]">{user.fullName}</div>
              <div className="text-[10px] text-slate-400">{UserRoleLabels[user.role as UserRole]}</div>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${avatarOpen ? "rotate-180" : ""}`} />
          </button>

          {avatarOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                <p className="text-xs text-slate-500">{UserRoleLabels[user.role as UserRole]}</p>
              </div>
              <button
                onClick={() => { onEditProfile(); setAvatarOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={14} className="text-slate-400" />
                {t("Profilni tahrirlash")}
              </button>
              <button
                onClick={() => { logout(); void router.navigate({ to: "/login" }); setAvatarOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />
                {t("Chiqish")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
