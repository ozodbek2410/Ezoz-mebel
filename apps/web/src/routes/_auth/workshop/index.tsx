import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, CheckCircle, Clock, User, Wrench,
  Calendar, UserCheck, MessageSquare, ShoppingBag,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Modal, Input, Tabs,
  Table, TableHead, TableBody, TableLoading, TableEmpty,
} from "@/components/ui";
import { StatusBadge } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { useT, getT } from "@/hooks/useT";
import toast from "react-hot-toast";

export function WorkshopPage() {
  const { isMaster, isBoss, user } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTaskId, setNotesTaskId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // Fetch all tasks (no status filter — grouping is done on frontend)
  const tasksQuery = useQuery({
    queryKey: ["workshop", "list"],
    queryFn: () => trpc.workshop.list.query(),
  });

  // Masters list for assignment
  const usersQuery = useQuery({
    queryKey: ["auth", "getUsers"],
    queryFn: () => trpc.auth.getUsers.query(),
    enabled: isBoss(),
  });
  const masters = (usersQuery.data ?? []).filter((u) => u.role === "MASTER");

  // Mutations
  const updateStatus = useMutation({
    mutationFn: (data: { taskId: number; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; notes?: string }) =>
      trpc.workshop.updateStatus.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      setNotesOpen(false);
      toast.success(getT()("Status yangilandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const assignTask = useMutation({
    mutationFn: (data: { taskId: number; assignedToId: number | null }) =>
      trpc.workshop.assignTask.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      toast.success(getT()("Usta tayinlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const tasks = tasksQuery.data ?? [];

  // Group tasks by saleId
  const saleGroups = useMemo(() => {
    const map = new Map<number, typeof tasks>();
    for (const task of tasks) {
      const group = map.get(task.saleId) ?? [];
      group.push(task);
      map.set(task.saleId, group);
    }
    return Array.from(map.values()).sort((a, b) => b[0]!.id - a[0]!.id);
  }, [tasks]);

  // Compute a group's overall status
  function groupStatus(groupTasks: typeof tasks): "PENDING" | "IN_PROGRESS" | "COMPLETED" {
    if (groupTasks.every((t) => t.status === "COMPLETED")) return "COMPLETED";
    if (groupTasks.some((t) => t.status === "IN_PROGRESS")) return "IN_PROGRESS";
    return "PENDING";
  }

  const filteredGroups = statusFilter === "all"
    ? saleGroups
    : saleGroups.filter((g) => groupStatus(g) === statusFilter);

  const pendingCount = saleGroups.filter((g) => groupStatus(g) === "PENDING").length;
  const inProgressCount = saleGroups.filter((g) => groupStatus(g) === "IN_PROGRESS").length;
  const completedCount = saleGroups.filter((g) => groupStatus(g) === "COMPLETED").length;

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("uz", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  // Clean up old-format descriptions like "Sotuv #cuid - kesish/xizmat"
  function getServiceName(description: string, saleItems: Array<{ serviceName: string | null }>) {
    if (description.startsWith("Sotuv #")) {
      return saleItems.find((i) => i.serviceName)?.serviceName ?? t("Xizmat/kesish");
    }
    return description;
  }

  const boss = isBoss();
  const colCount = 8;

  return (
    <div className="page-enter">
      <PageHeader
        title={t("Ustaxona")}
        subtitle={`${pendingCount} ${t("kutilmoqda")}, ${inProgressCount} ${t("bajarilmoqda")}`}
      />

      <div className="page-body">
        {/* Filter tabs */}
        <div className="mb-4">
          <Tabs
            tabs={[
              { id: "all", label: t("Barchasi"), count: saleGroups.length },
              { id: "PENDING", label: t("Kutilmoqda"), count: pendingCount },
              { id: "IN_PROGRESS", label: t("Bajarilmoqda"), count: inProgressCount },
              { id: "COMPLETED", label: t("Yakunlangan"), count: completedCount },
            ]}
            activeTab={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table variant="report">
            <TableHead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>{t("Buyurtma")}</th>
                <th>{t("Xizmat")}</th>
                <th>{t("Usta")}</th>
                <th className="text-center">{t("Holat")}</th>
                <th>{t("Sana")}</th>
                <th>{t("Izoh")}</th>
                <th className="w-28 text-center">{t("Amallar")}</th>
              </tr>
            </TableHead>
            <TableBody>
              {tasksQuery.isLoading ? (
                <TableLoading colSpan={colCount} />
              ) : filteredGroups.length === 0 ? (
                <TableEmpty colSpan={colCount} message={t("Vazifalar yo'q")} icon={<CheckCircle className="w-8 h-8" />} />
              ) : (
                filteredGroups.map((groupTasks) => {
                  const firstTask = groupTasks[0]!;
                  const sale = firstTask.sale;
                  const gStatus = groupStatus(groupTasks);

                  return groupTasks.map((task, taskIdx) => {
                    const isMyTask = isMaster() && task.assignedToId === user?.userId;
                    const serviceName = getServiceName(task.description, sale?.items ?? []);
                    const isFirstInGroup = taskIdx === 0;

                    return (
                      <tr
                        key={task.id}
                        className={`${isFirstInGroup && taskIdx > 0 ? "" : ""} ${
                          gStatus === "COMPLETED" ? "opacity-60" : ""
                        } ${isFirstInGroup ? "border-t-2 !border-t-slate-300" : ""}`}
                      >
                        {/* # — only on first task in group */}
                        {isFirstInGroup ? (
                          <td rowSpan={groupTasks.length} className="text-center text-slate-400 align-top pt-4">
                            {firstTask.saleId}
                          </td>
                        ) : null}

                        {/* Buyurtma — only on first task in group */}
                        {isFirstInGroup ? (
                          <td rowSpan={groupTasks.length} className="align-top pt-4">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-900">
                                {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                              </span>
                            </div>
                            {sale?.customer?.phone && (
                              <span className="text-xs text-slate-400 block ml-6">{sale.customer.phone}</span>
                            )}
                            {sale && sale.items.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2 ml-6">
                                {sale.items.map((item) => (
                                  <span key={item.id} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                    <ShoppingBag className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-600">{item.product?.name ?? item.serviceName ?? "—"}</span>
                                    <span className="text-slate-400">x{Number(item.quantity)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        ) : null}

                        {/* Xizmat */}
                        <td>
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="font-medium">{serviceName}</span>
                          </div>
                        </td>

                        {/* Usta */}
                        <td>
                          {task.assignedTo ? (
                            boss && task.status !== "COMPLETED" ? (
                              <select
                                className="select-field text-sm py-1 w-full"
                                value={task.assignedToId ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
                                  assignTask.mutate({ taskId: task.id, assignedToId: val });
                                }}
                              >
                                {masters.map((m) => (
                                  <option key={m.id} value={m.id}>{m.fullName}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="font-medium text-indigo-700">{task.assignedTo.fullName}</span>
                              </div>
                            )
                          ) : boss ? (
                            <select
                              className="select-field text-sm py-1 w-full"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) assignTask.mutate({ taskId: task.id, assignedToId: Number(e.target.value) });
                              }}
                            >
                              <option value="">{t("Usta tanlang...")}</option>
                              {masters.map((m) => (
                                <option key={m.id} value={m.id}>{m.fullName}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-400 italic">{t("Tayinlanmagan")}</span>
                          )}
                        </td>

                        {/* Holat */}
                        <td className="text-center">
                          <StatusBadge status={task.status} />
                        </td>

                        {/* Sana */}
                        <td>
                          <div className="text-sm text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {sale ? formatDate(sale.createdAt) : "—"}
                            </div>
                            {task.startedAt && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                <Clock className="w-3 h-3" />
                                {t("Boshlangan")}: {formatDate(task.startedAt)}
                              </div>
                            )}
                            {task.completedAt && (
                              <div className="flex items-center gap-1.5 text-xs text-green-600 mt-1">
                                <CheckCircle className="w-3 h-3" />
                                {t("Yakunlangan")}: {formatDate(task.completedAt)}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Izoh */}
                        <td>
                          {task.notes ? (
                            <div className="flex items-start gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                              <span className="text-sm text-amber-700">{task.notes}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Amallar */}
                        <td className="text-center">
                          {(isMyTask || (boss && task.status !== "COMPLETED")) && task.status !== "COMPLETED" && (
                            <div className="flex items-center justify-center gap-1">
                              {task.status === "PENDING" && (isMyTask || boss) && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  loading={updateStatus.isPending}
                                  onClick={() => updateStatus.mutate({ taskId: task.id, status: "IN_PROGRESS" })}
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  {t("Boshlash")}
                                </Button>
                              )}
                              {task.status === "IN_PROGRESS" && (isMyTask || boss) && (
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => { setNotesTaskId(task.id); setNotes(""); setNotesOpen(true); }}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {t("Yakunlash")}
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Complete with notes modal */}
      <Modal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        title={t("Vazifani yakunlash")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNotesOpen(false)}>{t("Bekor qilish")}</Button>
            <Button
              variant="success"
              loading={updateStatus.isPending}
              onClick={() => {
                if (notesTaskId) updateStatus.mutate({ taskId: notesTaskId, status: "COMPLETED", notes: notes || undefined });
              }}
            >
              <CheckCircle className="w-4 h-4" />
              {t("Yakunlash")}
            </Button>
          </>
        }
      >
        <Input
          label={t("Izoh (ixtiyoriy)")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("Bajarilgan ish haqida izoh...")}
        />
      </Modal>
    </div>
  );
}
