import { z } from "zod";
import bcrypt from "bcrypt";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, bossProcedure } from "../trpc";
import { loginSchema, changePasswordSchema, createUserSchema, updateUserSchema } from "@ezoz/shared";

export const authRouter = router({
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { username: input.username },
      });

      if (!user || !user.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Foydalanuvchi topilmadi" });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Parol noto'g'ri" });
      }

      // Parse custom permissions
      let customPermissions: string[] | null = null;
      if (user.customPermissions) {
        try {
          customPermissions = JSON.parse(user.customPermissions);
        } catch { /* ignore */ }
      }

      return {
        userId: user.id,
        role: user.role,
        fullName: user.fullName,
        customPermissions,
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.userId },
      select: { id: true, username: true, fullName: true, role: true, customPermissions: true },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Foydalanuvchi topilmadi" });
    }
    let customPermissions: string[] | null = null;
    if (user.customPermissions) {
      try { customPermissions = JSON.parse(user.customPermissions); } catch { /* ignore */ }
    }
    return { ...user, customPermissions };
  }),

  // Login sahifasida user ro'yxatini ko'rsatish uchun (public — faqat ism va role)
  getLoginUsers: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, fullName: true, role: true },
      orderBy: { id: "asc" },
    });
  }),

  // Authenticated userlar uchun to'liq ro'yxat
  getUsers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        customPermissions: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    });
  }),

  // Get all users including deactivated (boss only)
  getAllUsers: bossProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        role: true,
        baseSalaryUzs: true,
        bonusPerJob: true,
        customPermissions: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    });
  }),

  createUser: bossProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { username: input.username } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Bu foydalanuvchi nomi band" });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await ctx.db.user.create({
        data: {
          username: input.username,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone ?? null,
          role: input.role,
          baseSalaryUzs: input.baseSalaryUzs ?? 0,
          bonusPerJob: input.bonusPerJob ?? 0,
          customPermissions: input.customPermissions
            ? JSON.stringify(input.customPermissions)
            : null,
        },
      });

      return { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    }),

  updateUser: bossProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      // Boss cannot modify own role
      if (user.role === "BOSS" && input.role) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Boss rolini o'zgartirish mumkin emas" });
      }

      const data: Record<string, unknown> = {};
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.role !== undefined) data.role = input.role;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.baseSalaryUzs !== undefined) data.baseSalaryUzs = input.baseSalaryUzs;
      if (input.bonusPerJob !== undefined) data.bonusPerJob = input.bonusPerJob;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.customPermissions !== undefined) {
        data.customPermissions = input.customPermissions
          ? JSON.stringify(input.customPermissions)
          : null;
      }

      await ctx.db.user.update({ where: { id: input.id }, data });
      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: ctx.user.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Joriy parol noto'g'ri" });

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await ctx.db.user.update({
        where: { id: ctx.user.userId },
        data: { passwordHash: newHash },
      });
      return { success: true };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      fullName: z.string().min(2).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, string> = {};
      if (input.fullName) data.fullName = input.fullName;

      if (Object.keys(data).length === 0) return { success: true };

      await ctx.db.user.update({
        where: { id: ctx.user.userId },
        data,
      });
      return { success: true };
    }),

  resetPassword: bossProcedure
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(4),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await ctx.db.user.update({
        where: { id: input.userId },
        data: { passwordHash: newHash },
      });
      return { success: true };
    }),
});
