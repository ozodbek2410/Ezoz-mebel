import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, CheckCircle, Clock, User, Wrench,
  Plus, Trash2, ChevronRight, Package,
  MessageSquare, Calendar, UserCheck, ListChecks,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Modal, Input, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { useT, getT } from "@/hooks/useT";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkshopTask = {
  id: number;
  saleId: number;
  description: string;
  stepOrder: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  notes: string | null;
  assignedToId: number | null;
  assignedTo: { id: number; fullName: string; role: string } | null;
  sale: {
    customer: { fullName: string; phone: string | null } | null;
    items: {
      id: number;
      serviceName: string | null;
      quantity: unknown;
      product: { name: string } | null;
    }[];
  } | null;
};

type PendingSetupSale = {
  id: number;
  documentNo: string;
  createdAt: string | Date;
  customer: { id: number; fullName: string; phone: string | null } | null;
  items: {
    id: number;
    serviceName: string | null;
    quantity: unknown;
    product: { name: string } | null;
  }[];
  cashier: { id: number; fullName: string } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("uz", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stepStatusIcon(status: string) {
  if (status === "COMPLETED") return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (status === "IN_PROGRESS") return <Play className="w-4 h-4 text-amber-500" />;
  return <Clock className="w-4 h-4 text-slate-300" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkshopPage() {
  const { isMaster, isBoss } = useAuth();
  const boss = isBoss();
  const master = isMaster();

  if (boss) return <BossView />;
  if (master) return <MasterView />;
  return <ServiceView />;
}

// ─── Boss View ────────────────────────────────────────────────────────────────

function BossView() {
  const t = useT();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("setup");

  // Setup modal
  const [setupSale, setSetupSale] = useState<PendingSetupSale | null>(null);
  const [setupTasks, setSetupTasksList] = useState<{ description: string; assignedToId: number | null }[]>([
    { description: "", assignedToId: null },
  ]);

  // Complete modal (boss can also complete on behalf)
  const [completeTaskId, setCompleteTaskId] = useState<number | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");

  // Queries
  const pendingSetupQuery = useQuery({
    queryKey: ["workshop", "pendingSetup"],
    queryFn: () => trpc.workshop.listPendingSetup.query(),
    staleTime: 30 * 1000,
  });

  const tasksQuery = useQuery({
    queryKey: ["workshop", "list"],
    queryFn: () => trpc.workshop.list.query(),
    staleTime: 30 * 1000,
  });

  const usersQuery = useQuery({
    queryKey: ["auth", "getUsers"],
    queryFn: () => trpc.auth.getUsers.query(),
    staleTime: 5 * 60 * 1000,
  });
  const masters = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.role === "MASTER"),
    [usersQuery.data],
  );

  // Mutations
  const setupTasksMutation = useMutation({
    mutationFn: (data: { saleId: number; tasks: { description: string; assignedToId?: number }[] }) =>
      trpc.workshop.setupTasks.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      setSetupSale(null);
      setSetupTasksList([{ description: "", assignedToId: null }]);
      toast.success(getT()("Bosqichlar belgilandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const startTaskMutation = useMutation({
    mutationFn: (taskId: number) => trpc.workshop.startTask.mutate({ taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      toast.success(getT()("Boshlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const completeStepMutation = useMutation({
    mutationFn: (data: { taskId: number; notes?: string }) =>
      trpc.workshop.completeStep.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setCompleteTaskId(null);
      setCompleteNotes("");
      toast.success(getT()("Yakunlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const assignTaskMutation = useMutation({
    mutationFn: (data: { taskId: number; assignedToId: number | null }) =>
      trpc.workshop.assignTask.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      toast.success(getT()("Usta tayinlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  // Group active tasks by sale
  const allTasks = (tasksQuery.data as WorkshopTask[] | undefined) ?? [];
  const saleGroups = useMemo(() => {
    const map = new Map<number, WorkshopTask[]>();
    for (const task of allTasks) {
      const group = map.get(task.saleId) ?? [];
      group.push(task);
      map.set(task.saleId, group);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aId = a[0]?.saleId ?? 0;
      const bId = b[0]?.saleId ?? 0;
      return bId - aId;
    });
  }, [allTasks]);

  const inProgressGroups = saleGroups.filter((g) =>
    g.some((t) => t.status === "IN_PROGRESS" || t.status === "PENDING") &&
    !g.every((t) => t.status === "COMPLETED"),
  );
  const completedGroups = saleGroups.filter((g) => g.every((t) => t.status === "COMPLETED"));

  const pendingSales = (pendingSetupQuery.data as PendingSetupSale[] | undefined) ?? [];

  function openSetupModal(sale: PendingSetupSale) {
    setSetupSale(sale);
    setSetupTasksList([{ description: "", assignedToId: null }]);
  }

  function addStep() {
    setSetupTasksList((prev) => [...prev, { description: "", assignedToId: null }]);
  }

  function removeStep(idx: number) {
    setSetupTasksList((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, field: "description" | "assignedToId", value: string | number | null) {
    setSetupTasksList((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s,
      ),
    );
  }

  function handleSetupSubmit() {
    if (!setupSale) return;
    const invalidStep = setupTasks.findIndex((s) => !s.description.trim());
    if (invalidStep >= 0) {
      toast.error(getT()(`${invalidStep + 1}-bosqich nomini kiriting`));
      return;
    }
    setupTasksMutation.mutate({
      saleId: setupSale.id,
      tasks: setupTasks.map((s) => ({
        description: s.description.trim(),
        assignedToId: s.assignedToId ?? undefined,
      })),
    });
  }

  return (
    <div className="page-enter">
      <PageHeader
        title={t("Ustaxona")}
        subtitle={`${pendingSales.length} ${t("belgilanmagan")}, ${inProgressGroups.length} ${t("jarayonda")}`}
      />

      <div className="page-body">
        <div className="mb-4">
          <Tabs
            tabs={[
              { id: "setup", label: t("Belgilanmagan"), count: pendingSales.length },
              { id: "progress", label: t("Jarayonda"), count: inProgressGroups.length },
              { id: "done", label: t("Yakunlangan"), count: completedGroups.length },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* ── Tab: Belgilanmagan ── */}
        {activeTab === "setup" && (
          <div className="space-y-3">
            {pendingSetupQuery.isLoading ? (
              <div className="card !p-8 text-center text-slate-400">{t("Yuklanmoqda...")}</div>
            ) : pendingSales.length === 0 ? (
              <div className="card !p-10 text-center">
                <ListChecks className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">{t("Belgilanishi kerak bo'lgan buyurtma yo'q")}</p>
              </div>
            ) : (
              pendingSales.map((sale) => (
                <div key={sale.id} className="card !p-0 overflow-hidden">
                  <div className="flex items-start gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          #{sale.documentNo}
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(sale.createdAt)}</span>
                        {sale.cashier && (
                          <span className="text-xs text-slate-400">
                            {t("Kassir")}: {sale.cashier.fullName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {sale.customer?.fullName ?? t("Oddiy mijoz")}
                        </span>
                        {sale.customer?.phone && (
                          <span className="text-xs text-slate-400">{sale.customer.phone}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sale.items.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 rounded px-2 py-0.5"
                          >
                            {item.serviceName ? (
                              <Wrench className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Package className="w-3 h-3 text-indigo-400" />
                            )}
                            <span className="text-slate-600">
                              {item.product?.name ?? item.serviceName ?? "—"}
                            </span>
                            <span className="text-slate-400">×{Number(item.quantity)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openSetupModal(sale)}
                    >
                      <ListChecks className="w-4 h-4" />
                      {t("Bosqichlarni belgilash")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Jarayonda ── */}
        {activeTab === "progress" && (
          <div className="space-y-4">
            {tasksQuery.isLoading ? (
              <div className="card !p-8 text-center text-slate-400">{t("Yuklanmoqda...")}</div>
            ) : inProgressGroups.length === 0 ? (
              <div className="card !p-10 text-center">
                <Wrench className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">{t("Hozirda jarayondagi buyurtma yo'q")}</p>
              </div>
            ) : (
              inProgressGroups.map((groupTasks) => {
                const firstTask = groupTasks[0]!;
                const sale = firstTask.sale;
                return (
                  <div key={firstTask.saleId} className="card !p-0 overflow-hidden">
                    {/* Sale header */}
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                          </span>
                          {sale?.customer?.phone && (
                            <span className="text-xs text-slate-400">{sale.customer.phone}</span>
                          )}
                        </div>
                        {sale && sale.items.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 ml-6">
                            {sale.items.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5"
                              >
                                {item.serviceName ? (
                                  <Wrench className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <Package className="w-3 h-3 text-indigo-300" />
                                )}
                                <span className="text-slate-500">
                                  {item.product?.name ?? item.serviceName ?? "—"}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step chain */}
                    <div className="divide-y divide-slate-50">
                      {groupTasks.map((task, idx) => {
                        const isActive = task.status !== "COMPLETED";
                        return (
                          <div
                            key={task.id}
                            className={`flex items-start gap-3 px-4 py-3 ${task.status === "IN_PROGRESS" ? "bg-amber-50/50" : ""}`}
                          >
                            {/* Step number + connector */}
                            <div className="flex flex-col items-center gap-1 pt-0.5">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                                  task.status === "COMPLETED"
                                    ? "bg-green-100 border-green-400 text-green-700"
                                    : task.status === "IN_PROGRESS"
                                    ? "bg-amber-100 border-amber-400 text-amber-700"
                                    : "bg-slate-100 border-slate-200 text-slate-400"
                                }`}
                              >
                                {idx + 1}
                              </div>
                              {idx < groupTasks.length - 1 && (
                                <div className={`w-0.5 h-4 rounded ${task.status === "COMPLETED" ? "bg-green-300" : "bg-slate-200"}`} />
                              )}
                            </div>

                            {/* Step content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-medium text-sm ${
                                    task.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-800"
                                  }`}
                                >
                                  {task.description}
                                </span>
                                <StatusBadge status={task.status} />
                              </div>

                              {/* Master */}
                              <div className="mt-1 flex items-center gap-2">
                                {isActive ? (
                                  <select
                                    className="select-field text-xs py-0.5 h-7"
                                    value={task.assignedToId ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value ? Number(e.target.value) : null;
                                      assignTaskMutation.mutate({ taskId: task.id, assignedToId: val });
                                    }}
                                  >
                                    <option value="">{t("Usta tanlang...")}</option>
                                    {masters.map((m) => (
                                      <option key={m.id} value={m.id}>{m.fullName}</option>
                                    ))}
                                  </select>
                                ) : task.assignedTo ? (
                                  <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <UserCheck className="w-3 h-3 text-indigo-400" />
                                    <span>{task.assignedTo.fullName}</span>
                                  </div>
                                ) : null}
                              </div>

                              {/* Timestamps & notes */}
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {task.startedAt && (
                                  <span className="text-[11px] text-amber-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(task.startedAt)}
                                  </span>
                                )}
                                {task.completedAt && (
                                  <span className="text-[11px] text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {formatDate(task.completedAt)}
                                  </span>
                                )}
                                {task.notes && (
                                  <span className="text-[11px] text-amber-700 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {task.notes}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            {isActive && (
                              <div className="shrink-0 flex gap-1">
                                {task.status === "PENDING" && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    loading={startTaskMutation.isPending}
                                    onClick={() => startTaskMutation.mutate(task.id)}
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    {t("Boshlash")}
                                  </Button>
                                )}
                                {task.status === "IN_PROGRESS" && (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() => {
                                      setCompleteTaskId(task.id);
                                      setCompleteNotes("");
                                    }}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    {t("Tugatish")}
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
              })
            )}
          </div>
        )}

        {/* ── Tab: Yakunlangan ── */}
        {activeTab === "done" && (
          <div className="space-y-3">
            {tasksQuery.isLoading ? (
              <div className="card !p-8 text-center text-slate-400">{t("Yuklanmoqda...")}</div>
            ) : completedGroups.length === 0 ? (
              <div className="card !p-10 text-center">
                <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">{t("Yakunlangan buyurtma yo'q")}</p>
              </div>
            ) : (
              completedGroups.map((groupTasks) => {
                const firstTask = groupTasks[0]!;
                const sale = firstTask.sale;
                const lastCompleted = groupTasks
                  .filter((t) => t.completedAt)
                  .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

                return (
                  <div key={firstTask.saleId} className="card !p-4 opacity-80">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-700">
                            {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                          </span>
                          {lastCompleted?.completedAt && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(lastCompleted.completedAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {groupTasks.map((task, idx) => (
                            <div key={task.id} className="flex items-center gap-1">
                              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                              <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded px-2 py-0.5">
                                {task.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Setup Tasks Modal ── */}
      <Modal
        open={!!setupSale}
        onClose={() => { setSetupSale(null); setSetupTasksList([{ description: "", assignedToId: null }]); }}
        title={t("Bosqichlarni belgilash")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSetupSale(null)}>{t("Bekor qilish")}</Button>
            <Button
              variant="primary"
              loading={setupTasksMutation.isPending}
              onClick={handleSetupSubmit}
            >
              <ListChecks className="w-4 h-4" />
              {t("Bosqichlarni saqlash")}
            </Button>
          </>
        }
      >
        {setupSale && (
          <div className="space-y-4">
            {/* Sale info */}
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-slate-800">
                  {setupSale.customer?.fullName ?? t("Oddiy mijoz")}
                </span>
                <span className="text-xs font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-500">
                  #{setupSale.documentNo}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 ml-6">
                {setupSale.items.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
                  >
                    {item.serviceName ? (
                      <Wrench className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Package className="w-3 h-3 text-indigo-300" />
                    )}
                    {item.product?.name ?? item.serviceName ?? "—"} ×{Number(item.quantity)}
                  </span>
                ))}
              </div>
            </div>

            {/* Task list */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">{t("Ketma-ket bosqichlar")}</p>
              {setupTasks.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {/* Step number */}
                  <div className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-indigo-300 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                    {idx + 1}
                  </div>
                  {/* Connector */}
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      className="input-field text-sm w-full"
                      placeholder={t("Bosqich nomi (masalan: Kesish, Qoplanish...)")}
                      value={step.description}
                      onChange={(e) => updateStep(idx, "description", e.target.value)}
                      autoFocus={idx === setupTasks.length - 1 && idx > 0}
                    />
                    <select
                      className="input-field text-sm w-full"
                      value={step.assignedToId ?? ""}
                      onChange={(e) => updateStep(idx, "assignedToId", e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">{t("Usta tanlang (ixtiyoriy)")}</option>
                      {masters.map((m) => (
                        <option key={m.id} value={m.id}>{m.fullName}</option>
                      ))}
                    </select>
                  </div>
                  {/* Remove */}
                  {setupTasks.length > 1 && (
                    <button
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors mt-1"
                      onClick={() => removeStep(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mt-2 transition-colors"
                onClick={addStep}
              >
                <Plus className="w-4 h-4" />
                {t("Bosqich qo'shish")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Complete Step Modal ── */}
      <Modal
        open={!!completeTaskId}
        onClose={() => { setCompleteTaskId(null); setCompleteNotes(""); }}
        title={t("Bosqichni yakunlash")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteTaskId(null)}>{t("Bekor qilish")}</Button>
            <Button
              variant="success"
              loading={completeStepMutation.isPending}
              onClick={() => {
                if (completeTaskId) {
                  completeStepMutation.mutate({ taskId: completeTaskId, notes: completeNotes || undefined });
                }
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
          value={completeNotes}
          onChange={(e) => setCompleteNotes(e.target.value)}
          placeholder={t("Bajarilgan ish haqida izoh...")}
        />
      </Modal>
    </div>
  );
}

// ─── Master View ──────────────────────────────────────────────────────────────

function MasterView() {
  const { user } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();

  const [completeTaskId, setCompleteTaskId] = useState<number | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["workshop", "list"],
    queryFn: () => trpc.workshop.list.query(),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const startTaskMutation = useMutation({
    mutationFn: (taskId: number) => trpc.workshop.startTask.mutate({ taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      toast.success(getT()("Boshlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const completeStepMutation = useMutation({
    mutationFn: (data: { taskId: number; notes?: string }) =>
      trpc.workshop.completeStep.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      setCompleteTaskId(null);
      setCompleteNotes("");
      toast.success(getT()("Yakunlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const allTasks = (tasksQuery.data as WorkshopTask[] | undefined) ?? [];

  // Group by saleId
  const saleGroups = useMemo(() => {
    const map = new Map<number, WorkshopTask[]>();
    for (const task of allTasks) {
      const group = map.get(task.saleId) ?? [];
      group.push(task);
      map.set(task.saleId, group);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aId = a[0]?.saleId ?? 0;
      const bId = b[0]?.saleId ?? 0;
      return bId - aId;
    });
  }, [allTasks]);

  const myUserId = user?.userId;

  // For each sale group, find the "active" task for this master
  // A task is actionable if it's assigned to me AND all previous steps are COMPLETED
  function getActiveTask(groupTasks: WorkshopTask[]): WorkshopTask | null {
    for (const task of groupTasks) {
      if (task.assignedToId !== myUserId) continue;
      if (task.status === "COMPLETED") continue;
      // Check if all previous steps done
      const prevTasks = groupTasks.filter((t) => t.stepOrder < task.stepOrder);
      if (prevTasks.every((t) => t.status === "COMPLETED")) {
        return task;
      }
    }
    return null;
  }

  const activeSaleGroups = saleGroups.filter((g) => getActiveTask(g) !== null);
  const waitingGroups = saleGroups.filter((g) => {
    // Has a task assigned to me that's not completed, but not yet ready (prev steps pending)
    const hasMyTask = g.some(
      (t) => t.assignedToId === myUserId && t.status !== "COMPLETED",
    );
    return hasMyTask && getActiveTask(g) === null;
  });
  const doneGroups = saleGroups.filter((g) =>
    g.filter((t) => t.assignedToId === myUserId).every((t) => t.status === "COMPLETED") &&
    g.some((t) => t.assignedToId === myUserId),
  );

  return (
    <div className="page-enter">
      <PageHeader
        title={t("Mening vazifalarim")}
        subtitle={`${activeSaleGroups.length} ${t("faol")}, ${waitingGroups.length} ${t("kutilmoqda")}`}
      />

      <div className="page-body space-y-6">

        {/* Active tasks */}
        {activeSaleGroups.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              {t("Bajarish kerak")}
            </h3>
            {activeSaleGroups.map((groupTasks) => {
              const activeTask = getActiveTask(groupTasks)!;
              const sale = activeTask.sale;
              return (
                <div key={activeTask.saleId} className="card !p-0 overflow-hidden border-l-4 border-l-amber-400">
                  {/* Header */}
                  <div className="flex items-start gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                        </span>
                        {sale?.customer?.phone && (
                          <span className="text-xs text-slate-400">{sale.customer.phone}</span>
                        )}
                      </div>
                      {/* Items */}
                      {sale && sale.items.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-6 mb-2">
                          {sale.items.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 text-[11px] bg-slate-100 rounded px-1.5 py-0.5"
                            >
                              {item.serviceName ? (
                                <Wrench className="w-3 h-3 text-amber-400" />
                              ) : (
                                <Package className="w-3 h-3 text-indigo-300" />
                              )}
                              <span className="text-slate-500">
                                {item.product?.name ?? item.serviceName ?? "—"}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Step chain for context */}
                      <div className="flex items-center gap-1 flex-wrap ml-6">
                        {groupTasks.map((task, idx) => (
                          <div key={task.id} className="flex items-center gap-1">
                            {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                            <span
                              className={`text-xs rounded px-2 py-0.5 border ${
                                task.id === activeTask.id
                                  ? "bg-amber-100 border-amber-300 text-amber-800 font-semibold"
                                  : task.status === "COMPLETED"
                                  ? "bg-green-50 border-green-200 text-green-600 line-through"
                                  : "bg-slate-50 border-slate-200 text-slate-400"
                              }`}
                            >
                              {task.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active task action bar */}
                  <div className="border-t border-slate-100 px-4 py-3 bg-amber-50/50 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {stepStatusIcon(activeTask.status)}
                        <span className="font-semibold text-slate-800">{activeTask.description}</span>
                        <span className="text-xs text-slate-400">({t("Bosqich")} {activeTask.stepOrder})</span>
                      </div>
                      {activeTask.startedAt && (
                        <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {t("Boshlangan")}: {formatDate(activeTask.startedAt)}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0">
                      {activeTask.status === "PENDING" && (
                        <Button
                          variant="primary"
                          loading={startTaskMutation.isPending}
                          onClick={() => startTaskMutation.mutate(activeTask.id)}
                        >
                          <Play className="w-4 h-4" />
                          {t("Boshlash")}
                        </Button>
                      )}
                      {activeTask.status === "IN_PROGRESS" && (
                        <Button
                          variant="success"
                          onClick={() => {
                            setCompleteTaskId(activeTask.id);
                            setCompleteNotes("");
                          }}
                        >
                          <CheckCircle className="w-4 h-4" />
                          {t("Tugatish")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Waiting tasks (prev step not done) */}
        {waitingGroups.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {t("Oldingi bosqich kutilmoqda")}
            </h3>
            {waitingGroups.map((groupTasks) => {
              const myTask = groupTasks.find(
                (t) => t.assignedToId === myUserId && t.status !== "COMPLETED",
              )!;
              const sale = myTask.sale;
              const prevTask = groupTasks.find((t) => t.stepOrder === myTask.stepOrder - 1);
              return (
                <div
                  key={myTask.saleId}
                  className="card !p-4 opacity-70 border-l-4 border-l-slate-200"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-300 mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-600">
                          {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {t("Sizning vazifangiz")}: <strong>{myTask.description}</strong>
                      </p>
                      {prevTask && (
                        <p className="text-xs text-slate-400 mt-1">
                          {t("Kutilmoqda")}: {prevTask.description}{" "}
                          {prevTask.assignedTo ? `(${prevTask.assignedTo.fullName})` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {tasksQuery.isLoading && (
          <div className="card !p-12 text-center text-slate-400">{t("Yuklanmoqda...")}</div>
        )}

        {/* Empty state */}
        {!tasksQuery.isLoading && activeSaleGroups.length === 0 && waitingGroups.length === 0 && (
          <div className="card !p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-3" />
            <p className="text-slate-400">{t("Hozirda sizga vazifa yo'q")}</p>
          </div>
        )}

        {/* Completed today */}
        {doneGroups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {t("Yakunlangan")}
            </h3>
            {doneGroups.map((groupTasks) => {
              const myTask = groupTasks.find((t) => t.assignedToId === myUserId);
              const sale = myTask?.sale;
              return (
                <div
                  key={groupTasks[0]!.saleId}
                  className="card !p-3 opacity-60 flex items-center gap-3"
                >
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-slate-600">
                      {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                    </span>
                    {" — "}
                    <span className="text-slate-400">{myTask?.description}</span>
                  </div>
                  {myTask?.completedAt && (
                    <span className="text-xs text-slate-400">{formatDate(myTask.completedAt)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete Modal */}
      <Modal
        open={!!completeTaskId}
        onClose={() => { setCompleteTaskId(null); setCompleteNotes(""); }}
        title={t("Bosqichni yakunlash")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteTaskId(null)}>{t("Bekor qilish")}</Button>
            <Button
              variant="success"
              loading={completeStepMutation.isPending}
              onClick={() => {
                if (completeTaskId) {
                  completeStepMutation.mutate({ taskId: completeTaskId, notes: completeNotes || undefined });
                }
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
          value={completeNotes}
          onChange={(e) => setCompleteNotes(e.target.value)}
          placeholder={t("Bajarilgan ish haqida izoh...")}
        />
      </Modal>
    </div>
  );
}

// ─── Service Cashier View ─────────────────────────────────────────────────────

function ServiceView() {
  const t = useT();

  const tasksQuery = useQuery({
    queryKey: ["workshop", "list"],
    queryFn: () => trpc.workshop.list.query(),
    staleTime: 30 * 1000,
  });

  const allTasks = (tasksQuery.data as WorkshopTask[] | undefined) ?? [];
  const saleGroups = useMemo(() => {
    const map = new Map<number, WorkshopTask[]>();
    for (const task of allTasks) {
      const group = map.get(task.saleId) ?? [];
      group.push(task);
      map.set(task.saleId, group);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aId = a[0]?.saleId ?? 0;
      const bId = b[0]?.saleId ?? 0;
      return bId - aId;
    });
  }, [allTasks]);

  const inProgress = saleGroups.filter((g) =>
    !g.every((t) => t.status === "COMPLETED"),
  );
  const completed = saleGroups.filter((g) => g.every((t) => t.status === "COMPLETED"));

  return (
    <div className="page-enter">
      <PageHeader
        title={t("Ustaxona")}
        subtitle={`${inProgress.length} ${t("jarayonda")}, ${completed.length} ${t("tayyor")}`}
      />
      <div className="page-body space-y-3">
        {tasksQuery.isLoading ? (
          <div className="card !p-8 text-center text-slate-400">{t("Yuklanmoqda...")}</div>
        ) : saleGroups.length === 0 ? (
          <div className="card !p-12 text-center">
            <Wrench className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400">{t("Ustaxonada hech narsa yo'q")}</p>
          </div>
        ) : (
          saleGroups.map((groupTasks) => {
            const firstTask = groupTasks[0]!;
            const sale = firstTask.sale;
            const allDone = groupTasks.every((t) => t.status === "COMPLETED");
            return (
              <div
                key={firstTask.saleId}
                className={`card !p-0 overflow-hidden ${allDone ? "opacity-70 border-l-4 border-l-green-400" : "border-l-4 border-l-amber-400"}`}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">
                        {sale?.customer?.fullName ?? t("Oddiy mijoz")}
                      </span>
                      {allDone && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                          <CheckCircle className="w-3 h-3" />
                          {t("Tayyor")}
                        </span>
                      )}
                    </div>
                    {/* Step chain */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {groupTasks.map((task, idx) => (
                        <div key={task.id} className="flex items-center gap-1">
                          {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                          <div className="flex items-center gap-1 text-xs">
                            {stepStatusIcon(task.status)}
                            <span
                              className={
                                task.status === "COMPLETED"
                                  ? "text-slate-400 line-through"
                                  : task.status === "IN_PROGRESS"
                                  ? "text-amber-700 font-medium"
                                  : "text-slate-500"
                              }
                            >
                              {task.description}
                            </span>
                            {task.assignedTo && (
                              <span className="text-slate-300">({task.assignedTo.fullName})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
