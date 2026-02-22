import { z } from "zod";
import { router, protectedProcedure, masterProcedure, bossProcedure } from "../trpc";

export const workshopRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.workshopTask.findMany({
        where: input?.status ? { status: input.status } : {},
        include: {
          assignedTo: { select: { id: true, fullName: true, role: true } },
          sale: {
            include: {
              customer: { select: { fullName: true, phone: true } },
              items: true,
            },
          },
          photos: true,
        },
        orderBy: { id: "desc" },
      });
    }),

  updateStatus: masterProcedure
    .input(z.object({
      taskId: z.number(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.workshopTask.update({
        where: { id: input.taskId },
        data: {
          status: input.status,
          notes: input.notes,
          ...(input.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
          ...(input.status === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
      });

      if (input.status === "COMPLETED") {
        await ctx.db.sale.update({
          where: { id: task.saleId },
          data: { workshopStatus: "COMPLETED" },
        });
        ctx.io?.to("room:service").to("room:boss").emit("workshop:taskCompleted", {
          taskId: task.id,
          masterId: ctx.user.userId.toString(),
        });
      }

      return task;
    }),

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
