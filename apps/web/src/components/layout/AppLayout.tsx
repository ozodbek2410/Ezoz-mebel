import { useState, useEffect, useCallback } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "react-hot-toast";
import { BirthdayAlert } from "@/components/shared/BirthdayAlert";
import { useBirthdayAlert } from "@/hooks/useBirthdayAlert";
import { useCurrencyStore } from "@/store/currency.store";
import { useUIStore } from "@/store/ui.store";
import { connectSocket } from "@/lib/socket";
import { useSocketEvent } from "@/hooks/useSocket";
import { EditProfileModal } from "./Sidebar";
import { useAuthStore } from "@/store/auth.store";
import { trpc } from "@/lib/trpc";

export function AppLayout() {
  const { show, customers, dismiss } = useBirthdayAlert();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  useEffect(() => {
    connectSocket();
    useCurrencyStore.getState().loadRate();

    // Sync fresh permissions from server on every app load
    trpc.auth.me.query().then((me) => {
      useAuthStore.getState().updateProfile({
        fullName: me.fullName,
        customPermissions: me.customPermissions,
      });
    }).catch(() => { /* ignore — offline or token expired */ });
  }, []);

  const handleRateChange = useCallback((data: { rate: number }) => {
    useCurrencyStore.getState().setRate(data.rate);
  }, []);
  useSocketEvent("currency:rateChanged", handleRateChange);

  return (
    <div className="flex min-h-screen bg-page-bg">
      <Sidebar />
      <div className={sidebarCollapsed ? "main-content-collapsed" : "main-content"}>
        <Topbar onEditProfile={() => setEditProfileOpen(true)} />
        <main className="overflow-y-auto">
          <Outlet />
        </main>
      </div>
      {editProfileOpen && <EditProfileModal onClose={() => setEditProfileOpen(false)} />}
      {show && <BirthdayAlert customers={customers} onDismiss={dismiss} />}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: "14px" },
          success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
    </div>
  );
}
