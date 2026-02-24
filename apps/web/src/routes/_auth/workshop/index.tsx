import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, CheckCircle, Clock, User, Wrench, Package,
  Calendar, UserCheck, MessageSquare,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Modal, Input, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { formatUzs } from "@ezoz/shared";
import toast from "react-hot-toast";

export function WorkshopPage() {
  const { isMaster, isBoss } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTaskId, setNotesTaskId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // Queries
  const tasksQuery = useQuery({
    queryKey: ["workshop", "list", statusFilter],
    queryFn: () =>
      trpc.workshop.list.query(
        statusFilter !== "all" ? { status: statusFilter as "PENDING" | "IN_PROGRESS" | "COMPLETED" } : undefined,
      ),
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
      toast.success("Status yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignTask = useMutation({
    mutationFn: (data: { taskId: number; assignedToId: number | null }) =>
      trpc.workshop.assignTask.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      toast.success("Usta tayinlandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const tasks = tasksQuery.data ?? [];
  const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("uz", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "IN_PROGRESS": return "border-l-blue-500 bg-blue-50/30";
      case "COMPLETED": return "border-l-green-500 bg-green-50/20 opacity-75";
      default: return "border-l-amber-400";
    }
  }

  return (
    <>
      <PageHeader
        title="Ustaxona"
        subtitle={`${pendingCount} kutilmoqda, ${inProgressCount} bajarilmoqda`}
      />

      <div className="page-body">
        {/* Filter tabs */}
        <div className="mb-4">
          <Tabs
            tabs={[
              { id: "all", label: "Barchasi", count: tasks.length },
              { id: "PENDING", label: "Kutilmoqda", count: pendingCount },
              { id: "IN_PROGRESS", label: "Bajarilmoqda", count: inProgressCount },
              { id: "COMPLETED", label: "Yakunlangan", count: completedCount },
            ]}
            activeTab={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* Task cards */}
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
        ) : tasks.length === 0 ? (
          <div className="card card-body text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Vazifalar yo'q</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`card overflow-hidden border-l-4 ${getStatusColor(task.status)}`}
              >
                {/* Header: Customer + Date */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-sm text-gray-900">
                        {task.sale?.customer?.fullName ?? "Oddiy mijoz"}
                      </span>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {task.sale ? formatDate(task.sale.createdAt) : "—"}
                    </span>
                    {task.sale?.customer?.phone && (
                      <span>{task.sale.customer.phone}</span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Assigned master */}
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-500" />
                    {task.assignedTo ? (
                      <span className="text-sm font-medium text-brand-700">{task.assignedTo.fullName}</span>
                    ) : isBoss() ? (
                      <select
                        className="select-field text-sm py-1"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            assignTask.mutate({ taskId: task.id, assignedToId: Number(e.target.value) });
                          }
                        }}
                      >
                        <option value="">Usta tayinlash...</option>
                        {masters.map((m) => (
                          <option key={m.id} value={m.id}>{m.fullName}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Tayinlanmagan</span>
                    )}
                  </div>

                  {/* This task's service */}
                  <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-amber-900">{task.description}</span>
                  </div>

                  {/* Time info */}
                  {task.startedAt && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>Boshlangan: {formatDate(task.startedAt)}</span>
                    </div>
                  )}
                  {task.completedAt && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      <span>Yakunlangan: {formatDate(task.completedAt)}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {task.notes && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700">{task.notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isMaster() && task.status !== "COMPLETED" && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex gap-2">
                    {task.status === "PENDING" && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        loading={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ taskId: task.id, status: "IN_PROGRESS" })}
                      >
                        <Play className="w-3.5 h-3.5" />
                        Boshlash
                      </Button>
                    )}
                    {task.status === "IN_PROGRESS" && (
                      <Button
                        variant="success"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setNotesTaskId(task.id);
                          setNotes("");
                          setNotesOpen(true);
                        }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Yakunlash
                      </Button>
                    )}
                  </div>
                )}

                {/* Boss can reassign */}
                {isBoss() && task.assignedTo && task.status !== "COMPLETED" && (
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/30">
                    <select
                      className="select-field text-xs py-1"
                      value={task.assignedToId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        assignTask.mutate({ taskId: task.id, assignedToId: val });
                      }}
                    >
                      <option value="">Ustani o'zgartirish...</option>
                      {masters.map((m) => (
                        <option key={m.id} value={m.id}>{m.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete with notes modal */}
      <Modal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        title="Vazifani yakunlash"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNotesOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="success"
              loading={updateStatus.isPending}
              onClick={() => {
                if (notesTaskId) {
                  updateStatus.mutate({
                    taskId: notesTaskId,
                    status: "COMPLETED",
                    notes: notes || undefined,
                  });
                }
              }}
            >
              <CheckCircle className="w-4 h-4" />
              Yakunlash
            </Button>
          </>
        }
      >
        <Input
          label="Izoh (ixtiyoriy)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bajarilgan ish haqida izoh..."
        />
      </Modal>
    </>
  );
}
