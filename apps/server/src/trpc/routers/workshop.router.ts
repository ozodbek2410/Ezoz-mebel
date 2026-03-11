import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, masterProcedure, bossProcedure } from "../trpc";

export const workshopRouter = router({
  // All tasks — boss/service sees all, master sees only own
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.status) where["status"] = input.status;
      if (ctx.user.role === "MASTER") {
        where["assignedToId"] = ctx.user.userId;
      }

      return ctx.db.workshopTask.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, fullName: true, role: true } },
          sale: {
            include: {
              customer: { select: { fullName: true, phone: true } },
              items: { include: { product: { select: { name: true } } } },
            },
          },
          photos: true,
        },
        orderBy: [{ saleId: "desc" }, { stepOrder: "asc" }],
      });
    }),

  // Boss: sales that have goesToWorkshop=true but no tasks set up yet
  listPendingSetup: bossProcedure
    .query(async ({ ctx }) => {
      return ctx.db.sale.findMany({
        where: {
          goesToWorkshop: true,
          workshopStatus: "PENDING",
          workshopTasks: { none: {} },
        },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          items: { include: { product: { select: { name: true } } } },
          cashier: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Boss: set up ALL tasks for a sale at once
  setupTasks: bossProcedure
    .input(z.object({
      saleId: z.number(),
      tasks: z.array(z.object({
        description: z.string().min(1),
        assignedToId: z.number().optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const sale = await ctx.db.sale.findUnique({
        where: { id: input.saleId },
        include: { workshopTasks: true },
      });
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Sotuv topilmadi" });
      if (!sale.goesToWorkshop) throw new TRPCError({ code: "BAD_REQUEST", message: "Bu sotuv ustaxonaga yuborilmagan" });
      if (sale.workshopTasks.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Bosqichlar allaqachon belgilangan" });

      await ctx.db.workshopTask.createMany({
        data: input.tasks.map((task, idx) => ({
          saleId: input.saleId,
          description: task.description,
          assignedToId: task.assignedToId ?? null,
          stepOrder: idx + 1,
          status: "PENDING" as const,
        })),
      });

      ctx.io?.to("room:workshop").emit("workshop:newTask", {
        saleId: input.saleId,
        documentNo: sale.documentNo,
      });

      return { ok: true };
    }),

  // Master: start task (PENDING → IN_PROGRESS), checks prev steps done
  startTask: masterProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.workshopTask.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Topshiriq topilmadi" });
      if (task.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Topshiriq allaqachon boshlangan" });
      }

      // Ensure all previous steps are completed
      if (task.stepOrder > 1) {
        const prevTasks = await ctx.db.workshopTask.findMany({
          where: { saleId: task.saleId, stepOrder: { lt: task.stepOrder } },
        });
        if (!prevTasks.every((t) => t.status === "COMPLETED")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Oldingi bosqich hali tugallanmagan" });
        }
      }

      const updated = await ctx.db.workshopTask.update({
        where: { id: input.taskId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });

      // Update sale workshopStatus to IN_PROGRESS if still PENDING
      await ctx.db.sale.updateMany({
        where: { id: task.saleId, workshopStatus: "PENDING" },
        data: { workshopStatus: "IN_PROGRESS" },
      });

      return updated;
    }),

  // Master: complete step (no next-step creation — boss pre-defined all steps)
  completeStep: masterProcedure
    .input(z.object({
      taskId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.workshopTask.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Topshiriq topilmadi" });
      if (task.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Topshiriq allaqachon tugatilgan" });
      }

      await ctx.db.workshopTask.update({
        where: { id: input.taskId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          notes: input.notes,
          ...(task.startedAt ? {} : { startedAt: new Date() }),
        },
      });

      ctx.io?.to("room:service").to("room:boss").to("room:workshop").emit("workshop:taskCompleted", {
        taskId: task.id,
        saleId: task.saleId,
        masterId: ctx.user.userId.toString(),
      });

      // Check if there are remaining non-completed tasks
      const remaining = await ctx.db.workshopTask.count({
        where: { saleId: task.saleId, status: { not: "COMPLETED" } },
      });

      if (remaining === 0) {
        // All tasks done — decrement stock + mark sale workshop complete
        await ctx.db.sale.update({
          where: { id: task.saleId },
          data: { workshopStatus: "COMPLETED" },
        });

        const sale = await ctx.db.sale.findUnique({
          where: { id: task.saleId },
          include: { items: true },
        });

        if (sale?.warehouseId) {
          for (const item of sale.items) {
            if (item.productId) {
              await ctx.db.stockItem.update({
                where: {
                  productId_warehouseId: {
                    productId: item.productId,
                    warehouseId: sale.warehouseId,
                  },
                },
                data: { quantity: { decrement: Number(item.quantity) } },
              });

              const stock = await ctx.db.stockItem.findUnique({
                where: {
                  productId_warehouseId: {
                    productId: item.productId,
                    warehouseId: sale.warehouseId,
                  },
                },
                include: { product: true },
              });
              if (stock && Number(stock.quantity) <= Number(stock.product.minStockAlert)) {
                ctx.io?.to("room:stock").emit("stock:low", {
                  productId: item.productId,
                  productName: stock.product.name,
                  qty: Number(stock.quantity),
                });
              }
            }
          }
          ctx.io?.to("room:stock").emit("stock:updated", {});
        }

        // Auto-complete the sale (mark as COMPLETED / paid)
        await ctx.db.sale.update({
          where: { id: task.saleId },
          data: { status: "COMPLETED" },
        });

        ctx.io?.to("room:sales").to("room:boss").emit("sale:completed", {
          saleId: task.saleId,
          total: sale ? { uzs: Number(sale.totalUzs), usd: Number(sale.totalUsd) } : undefined,
        });

        ctx.io?.to("room:service").to("room:boss").emit("workshop:allCompleted", {
          saleId: task.saleId,
        });
      }

      return { ok: true };
    }),

  // Boss: reassign master to a task
  assignTask: bossProcedure
    .input(z.object({
      taskId: z.number(),
      assignedToId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workshopTask.update({
        where: { id: input.taskId },
        data: { assignedToId: input.assignedToId },
      });
    }),

  uploadPhoto: masterProcedure
    .input(z.object({
      taskId: z.number(),
      filePath: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workshopPhoto.create({
        data: {
          workshopTaskId: input.taskId,
          filePath: input.filePath,
          description: input.description,
        },
      });
    }),
});
