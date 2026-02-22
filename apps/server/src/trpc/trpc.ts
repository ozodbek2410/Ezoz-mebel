import { initTRPC, TRPCError } from "@trpc/server";
import { type UserRole } from "@ezoz/shared";
import { type Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected: requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Tizimga kirishingiz kerak" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Role-based procedures
function requireRole(...roles: UserRole[]) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Tizimga kirishingiz kerak" });
    }
    if (!roles.includes(ctx.user.role as UserRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sizda bu amalni bajarish huquqi yo'q" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const bossProcedure = t.procedure.use(requireRole("BOSS"));
export const cashierSalesProcedure = t.procedure.use(requireRole("BOSS", "CASHIER_SALES"));
export const cashierServiceProcedure = t.procedure.use(requireRole("BOSS", "CASHIER_SERVICE"));
export const masterProcedure = t.procedure.use(requireRole("BOSS", "MASTER"));
