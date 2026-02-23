import { useEffect, useCallback } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Toaster } from "react-hot-toast";
import { BirthdayAlert } from "@/components/shared/BirthdayAlert";
import { useBirthdayAlert } from "@/hooks/useBirthdayAlert";
import { useCurrencyStore } from "@/store/currency.store";
import { useUIStore } from "@/store/ui.store";
import { connectSocket } from "@/lib/socket";
import { useSocketEvent } from "@/hooks/useSocket";

export function AppLayout() {
  const { show, customers, dismiss } = useBirthdayAlert();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  // Load currency rate on startup
  useEffect(() => {
    connectSocket();
    useCurrencyStore.getState().loadRate();
  }, []);

  // Listen for rate changes via socket
  const handleRateChange = useCallback((data: { rate: number }) => {
    useCurrencyStore.getState().setRate(data.rate);
  }, []);
  useSocketEvent("currency:rateChanged", handleRateChange);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={sidebarCollapsed ? "main-content-collapsed" : "main-content"}>
        <Outlet />
      </main>
      {show && <BirthdayAlert customers={customers} onDismiss={dismiss} />}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: "14px" },
          success: { iconTheme: { primary: "#16a34a", secondary: "#fff" } },
          error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } },
        }}
      />
    </div>
  );
}
