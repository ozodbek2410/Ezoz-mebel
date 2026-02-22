export const UserRole = {
  BOSS: "BOSS",
  CASHIER_SALES: "CASHIER_SALES",
  CASHIER_SERVICE: "CASHIER_SERVICE",
  MASTER: "MASTER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserRoleLabels: Record<UserRole, string> = {
  BOSS: "Boshliq",
  CASHIER_SALES: "Kassir-Savdo",
  CASHIER_SERVICE: "Kassir-Xizmat",
  MASTER: "Usta",
};
