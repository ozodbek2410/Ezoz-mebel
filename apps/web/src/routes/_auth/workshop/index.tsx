import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, CheckCircle, Clock, User, Wrench,
  Calendar, UserCheck, MessageSquare, ShoppingBag,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Modal, Input, Tabs } from "@/components/ui";
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

  function getGroupColor(status: string) {
    switch (status) {
      case "IN_PROGRESS": return "border-l-blue-500 bg-blue-50/30";
      case "COMPLETED": return "border-l-green-500 bg-green-50/20 opacity-75";
      default: return "border-l-amber-400";
    }
  }

  // Clean up old-format descriptions like "Sotuv #cuid - kesish/xizmat"
  function getServiceName(description: string, saleItems: Array<{ serviceName: string | null }>) {
    if (description.startsWith("Sotuv #")) {
      return saleItems.find((i) => i.serviceName)?.serviceName ?? t("Xizmat/kesish");
    }
    return description;
  }

  return (
    <>
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

        {/* Sale group cards */}
        {tasksQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card card-body animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="card card-body text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">{t("Vazifalar yo'q")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGroups.map((groupTasks) => {
              const firstTask = groupTasks[0]!;
              const sale = firstTask.sale;
              const gStatus = groupStatus(groupTasks);

              return (
                <div
                  key={firstTask.saleId}
                  className={`card overflow-hidden border-l-4 ${getGroupColor(gStatus)}`}
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-sm text-gray-900">
                          {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">#{firstTask.saleId}</span>
                        <StatusBadge status={gStatus} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {sale ? formatDate(sale.createdAt) : "—"}
                      </span>
                      {sale?.customer?.phone && <span>{sale.customer.phone}</span>}
                    </div>
                  </div>

                  {/* Sale items (products + services) */}
                  {sale && sale.items.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                      <div className="flex flex-wrap gap-1.5">
                        {sale.items.map((item) => (
                          <span key={item.id} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-md px-2 py-0.5">
                            <ShoppingBag className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-700">{item.product?.name ?? item.serviceName ?? "—"}</span>
                            <span className="text-gray-400">x{Number(item.quantity)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks list */}
                  <div className="divide-y divide-gray-100">
                    {groupTasks.map((task) => {
                      const isMyTask = isMaster() && task.assignedToId === user?.userId;
                      const serviceName = getServiceName(task.description, sale?.items ?? []);

                      return (
                        <div key={task.id} className="p-4 space-y-2.5">
                          {/* Service name + status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="text-sm font-medium text-gray-900 truncate">{serviceName}</span>
                            </div>
                            <StatusBadge status={task.status} />
                          </div>

                          {/* Assigned master */}
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                            {task.assignedTo ? (
                              isBoss() && task.status !== "COMPLETED" ? (
                                <select
                                  className="select-field text-xs py-0.5 flex-1"
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
                                <span className="text-xs font-medium text-brand-700">{task.assignedTo.fullName}</span>
                              )
                            ) : isBoss() ? (
                              <select
                                className="select-field text-xs py-0.5 flex-1"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) assignTask.mutate({ taskId: task.id, assignedToId: Number(e.target.value) });
                                }}
                              >
                                <option value="">{t("Usta tayinlash...")} </option>
                                {masters.map((m) => (
                                  <option key={m.id} value={m.id}>{m.fullName}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-400 italic">{t("Tayinlanmagan")}</span>
                            )}
                          </div>

                          {/* Time info */}
                          {task.startedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>{t("Boshlangan")}: {formatDate(task.startedAt)}</span>
                            </div>
                          )}
                          {task.completedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              <span>{t("Yakunlangan")}: {formatDate(task.completedAt)}</span>
                            </div>
                          )}

                          {/* Notes */}
                          {task.notes && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                              <MessageSquare className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-amber-700">{task.notes}</p>
                            </div>
                          )}

                          {/* Action buttons — master only sees their own task */}
                          {isMyTask && task.status !== "COMPLETED" && (
                            <div className="flex gap-2 pt-1">
                              {task.status === "PENDING" && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="flex-1"
                                  loading={updateStatus.isPending}
                                  onClick={() => updateStatus.mutate({ taskId: task.id, status: "IN_PROGRESS" })}
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  {t("Boshlash")}
                                </Button>
                              )}
                              {task.status === "IN_PROGRESS" && (
                                <Button
                                  variant="success"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => { setNotesTaskId(task.id); setNotes(""); setNotesOpen(true); }}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {t("Yakunlash")}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    </>
  );
}
