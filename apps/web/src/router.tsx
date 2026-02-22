import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/routes/login";
import { DashboardPage } from "@/routes/_auth/dashboard";
import { ProductsPage } from "@/routes/_auth/products";
import { CustomersPage } from "@/routes/_auth/customers";
import { WarehousePage } from "@/routes/_auth/warehouse";
import { ExpensesPage } from "@/routes/_auth/expenses";
import { EmployeesPage } from "@/routes/_auth/employees";
import { SalesPage } from "@/routes/_auth/sales";
import { WorkshopPage } from "@/routes/_auth/workshop";
import { ReportsPage } from "@/routes/_auth/reports";
import { ReceiptsPage } from "@/routes/_auth/receipts";
import { AdminSettingsPage } from "@/routes/_auth/admin/settings";
import { MarketplaceSettingsPage } from "@/routes/_auth/admin/marketplace-settings";
import { MarketplacePage } from "@/routes/marketplace";
import { ServicesPage } from "@/routes/_auth/services";
import { useAuthStore } from "@/store/auth.store";
import { hasUserPermission, type Permission, type UserRole } from "@ezoz/shared";

function checkPermission(permission: Permission) {
  const { user } = useAuthStore.getState();
  if (!user) throw redirect({ to: "/login" });
  if (!hasUserPermission(user.role as UserRole, permission, user.customPermissions)) {
    throw redirect({ to: "/dashboard" });
  }
}

// Root route
const rootRoute = createRootRoute({
  component: Outlet,
});

// Login route (public)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

// Auth layout route (protected)
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  component: AppLayout,
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
});

// Dashboard
const dashboardRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/dashboard",
  component: DashboardPage,
});

// Index redirect
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const customersRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/customers",
  component: CustomersPage,
  beforeLoad: () => checkPermission("customer:read"),
});

const productsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/products",
  component: ProductsPage,
  beforeLoad: () => checkPermission("product:read"),
});

const warehouseRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/warehouse",
  component: WarehousePage,
  beforeLoad: () => checkPermission("warehouse:read"),
});

const salesRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/sales",
  component: SalesPage,
  beforeLoad: () => checkPermission("sale:product"),
});

const servicesRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/services",
  component: ServicesPage,
  beforeLoad: () => checkPermission("sale:service"),
});

const salesServiceRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/sales/service",
  component: SalesPage,
  beforeLoad: () => checkPermission("sale:service"),
});

const workshopRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/workshop",
  component: WorkshopPage,
  beforeLoad: () => checkPermission("workshop:view"),
});

const receiptsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/receipts",
  component: ReceiptsPage,
  beforeLoad: () => checkPermission("receipt:print"),
});

const expensesRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/expenses",
  component: ExpensesPage,
  beforeLoad: () => checkPermission("expense:create"),
});

const reportsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/reports",
  component: ReportsPage,
  beforeLoad: () => checkPermission("report:own"),
});

const employeesRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/employees",
  component: EmployeesPage,
  beforeLoad: () => checkPermission("employee:manage"),
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/admin/settings",
  component: AdminSettingsPage,
  beforeLoad: () => checkPermission("admin:settings"),
});

const marketplaceSettingsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/admin/marketplace-settings",
  component: MarketplaceSettingsPage,
  beforeLoad: () => checkPermission("marketplace:manage"),
});

// Marketplace (public)
const marketplaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/marketplace",
  component: MarketplacePage,
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  marketplaceRoute,
  authLayout.addChildren([
    dashboardRoute,
    customersRoute,
    productsRoute,
    warehouseRoute,
    salesRoute,
    servicesRoute,
    salesServiceRoute,
    workshopRoute,
    receiptsRoute,
    expensesRoute,
    reportsRoute,
    employeesRoute,
    adminSettingsRoute,
    marketplaceSettingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
