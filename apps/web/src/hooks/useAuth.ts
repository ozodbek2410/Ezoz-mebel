import { useAuthStore } from "@/store/auth.store";
import { hasUserPermission, type Permission, type UserRole } from "@ezoz/shared";

export function useAuth() {
  const { user, isAuthenticated, logout } = useAuthStore();

  function can(permission: Permission): boolean {
    if (!user) return false;
    return hasUserPermission(
      user.role as UserRole,
      permission,
      user.customPermissions,
    );
  }

  function isBoss(): boolean {
    return user?.role === "BOSS";
  }

  function isCashierSales(): boolean {
    return user?.role === "CASHIER_SALES";
  }

  function isCashierService(): boolean {
    return user?.role === "CASHIER_SERVICE";
  }

  function isMaster(): boolean {
    return user?.role === "MASTER";
  }

  return { user, isAuthenticated, logout, can, isBoss, isCashierSales, isCashierService, isMaster };
}
