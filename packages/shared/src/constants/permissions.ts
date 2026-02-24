import { UserRole } from "./roles";

export const Permissions = {
  // Customer
  CUSTOMER_READ: "customer:read",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_DELETE: "customer:delete",

  // Product
  PRODUCT_READ: "product:read",
  PRODUCT_CREATE: "product:create",
  PRODUCT_UPDATE: "product:update",
  PRODUCT_DELETE: "product:delete",
  PRODUCT_PRICE_BELOW_MIN: "product:price_below_min",

  // Category
  CATEGORY_MANAGE: "category:manage",

  // Warehouse
  WAREHOUSE_READ: "warehouse:read",
  WAREHOUSE_PURCHASE: "warehouse:purchase",
  WAREHOUSE_TRANSFER: "warehouse:transfer",
  WAREHOUSE_INVENTORY: "warehouse:inventory",
  WAREHOUSE_REVALUE: "warehouse:revalue",

  // Sale
  SALE_PRODUCT: "sale:product",
  SALE_SERVICE: "sale:service",

  // Payment
  PAYMENT_RECEIVE: "payment:receive",

  // Receipt
  RECEIPT_PRINT: "receipt:print",

  // Expense
  EXPENSE_CREATE: "expense:create",
  EXPENSE_VIEW_ALL: "expense:view_all",

  // Report
  REPORT_OWN: "report:own",
  REPORT_ALL: "report:all",

  // Employee
  EMPLOYEE_MANAGE: "employee:manage",
  EMPLOYEE_ADVANCE: "employee:advance",
  EMPLOYEE_SALARY: "employee:salary",

  // Workshop
  WORKSHOP_VIEW: "workshop:view",
  WORKSHOP_MANAGE: "workshop:manage",

  // Admin
  ADMIN_SETTINGS: "admin:settings",
  ADMIN_USERS: "admin:users",

  // Shift
  SHIFT_OWN: "shift:own",
  SHIFT_VIEW_ALL: "shift:view_all",

  // Marketplace
  MARKETPLACE_MANAGE: "marketplace:manage",

  // Dashboard
  DASHBOARD_VIEW: "dashboard:view",

  // Warehouse extended
  WAREHOUSE_WRITE_OFF: "warehouse:write_off",
  WAREHOUSE_RETURN: "warehouse:return",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const RolePermissions: Record<UserRole, readonly Permission[]> = {
  [UserRole.BOSS]: Object.values(Permissions),
  [UserRole.CASHIER_SALES]: [
    Permissions.DASHBOARD_VIEW,
    Permissions.CUSTOMER_READ,
    Permissions.CUSTOMER_CREATE,
    Permissions.CUSTOMER_UPDATE,
    Permissions.PRODUCT_READ,
    Permissions.WAREHOUSE_READ,
    Permissions.WAREHOUSE_PURCHASE,
    Permissions.SALE_PRODUCT,
    Permissions.PAYMENT_RECEIVE,
    Permissions.RECEIPT_PRINT,
    Permissions.EXPENSE_CREATE,
    Permissions.REPORT_OWN,
    Permissions.WORKSHOP_VIEW,
    Permissions.SHIFT_OWN,
  ],
  [UserRole.CASHIER_SERVICE]: [
    Permissions.DASHBOARD_VIEW,
    Permissions.CUSTOMER_READ,
    Permissions.CUSTOMER_CREATE,
    Permissions.CUSTOMER_UPDATE,
    Permissions.PRODUCT_READ,
    Permissions.WAREHOUSE_READ,
    Permissions.SALE_SERVICE,
    Permissions.PAYMENT_RECEIVE,
    Permissions.RECEIPT_PRINT,
    Permissions.EXPENSE_CREATE,
    Permissions.REPORT_OWN,
    Permissions.WORKSHOP_VIEW,
    Permissions.SHIFT_OWN,
  ],
  [UserRole.MASTER]: [
    Permissions.DASHBOARD_VIEW,
    Permissions.WORKSHOP_MANAGE,
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return RolePermissions[role].includes(permission);
}

export function getUserPermissions(role: UserRole, customPermissions?: string[] | null): Permission[] {
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions as Permission[];
  }
  return [...RolePermissions[role]];
}

export function hasUserPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: string[] | null,
): boolean {
  if (role === UserRole.BOSS) return true;
  const perms = getUserPermissions(role, customPermissions);
  return perms.includes(permission);
}

export interface PermissionGroupItem {
  key: Permission;
  label: string;
}

export interface PermissionGroup {
  title: string;
  permissions: PermissionGroupItem[];
}

export const PermissionGroups: PermissionGroup[] = [
  {
    title: "Bosh sahifa",
    permissions: [
      { key: Permissions.DASHBOARD_VIEW, label: "Bosh sahifani ko'rish" },
    ],
  },
  {
    title: "Mijozlar",
    permissions: [
      { key: Permissions.CUSTOMER_READ, label: "Ko'rish" },
      { key: Permissions.CUSTOMER_CREATE, label: "Yangi qo'shish" },
      { key: Permissions.CUSTOMER_UPDATE, label: "Tahrirlash" },
      { key: Permissions.CUSTOMER_DELETE, label: "O'chirish" },
    ],
  },
  {
    title: "Mahsulotlar",
    permissions: [
      { key: Permissions.PRODUCT_READ, label: "Ko'rish" },
      { key: Permissions.PRODUCT_CREATE, label: "Yangi qo'shish" },
      { key: Permissions.PRODUCT_UPDATE, label: "Tahrirlash" },
      { key: Permissions.PRODUCT_DELETE, label: "O'chirish" },
      { key: Permissions.PRODUCT_PRICE_BELOW_MIN, label: "Min. narxdan past sotish" },
    ],
  },
  {
    title: "Kategoriyalar",
    permissions: [
      { key: Permissions.CATEGORY_MANAGE, label: "Kategoriya boshqarish" },
    ],
  },
  {
    title: "Ombor",
    permissions: [
      { key: Permissions.WAREHOUSE_READ, label: "Qoldiqlarni ko'rish" },
      { key: Permissions.WAREHOUSE_PURCHASE, label: "Kirim qilish" },
      { key: Permissions.WAREHOUSE_TRANSFER, label: "Omborlar arasi ko'chirish" },
      { key: Permissions.WAREHOUSE_INVENTORY, label: "Inventarizatsiya" },
      { key: Permissions.WAREHOUSE_REVALUE, label: "Qayta baholash" },
      { key: Permissions.WAREHOUSE_WRITE_OFF, label: "Chiqim (mahsulot olib tashlash)" },
      { key: Permissions.WAREHOUSE_RETURN, label: "Qaytarish (yetkazuvchiga)" },
    ],
  },
  {
    title: "Savdo",
    permissions: [
      { key: Permissions.SALE_PRODUCT, label: "Savdo kassasi" },
      { key: Permissions.SALE_SERVICE, label: "Xizmat kassasi" },
    ],
  },
  {
    title: "Moliya",
    permissions: [
      { key: Permissions.PAYMENT_RECEIVE, label: "To'lov qabul qilish" },
      { key: Permissions.RECEIPT_PRINT, label: "Chek chop etish" },
      { key: Permissions.EXPENSE_CREATE, label: "Xarajat kiritish" },
      { key: Permissions.EXPENSE_VIEW_ALL, label: "Barcha xarajatlarni ko'rish" },
    ],
  },
  {
    title: "Hisobotlar",
    permissions: [
      { key: Permissions.REPORT_OWN, label: "O'z hisoboti" },
      { key: Permissions.REPORT_ALL, label: "Barcha hisobotlar" },
    ],
  },
  {
    title: "Xodimlar",
    permissions: [
      { key: Permissions.EMPLOYEE_MANAGE, label: "Xodimlarni boshqarish" },
      { key: Permissions.EMPLOYEE_ADVANCE, label: "Avans berish" },
      { key: Permissions.EMPLOYEE_SALARY, label: "Oylik to'lash" },
    ],
  },
  {
    title: "Ustaxona",
    permissions: [
      { key: Permissions.WORKSHOP_VIEW, label: "Vazifalarni ko'rish" },
      { key: Permissions.WORKSHOP_MANAGE, label: "Vazifalarni boshqarish" },
    ],
  },
  {
    title: "Admin",
    permissions: [
      { key: Permissions.ADMIN_SETTINGS, label: "Tizim sozlamalari" },
      { key: Permissions.ADMIN_USERS, label: "Foydalanuvchi boshqarish" },
      { key: Permissions.MARKETPLACE_MANAGE, label: "Marketplace boshqarish" },
    ],
  },
];
