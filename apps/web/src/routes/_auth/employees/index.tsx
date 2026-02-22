import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Banknote, Briefcase, Calculator, DollarSign,
  TrendingUp, TrendingDown, FileText,
  Save, Key, UserX, Shield, Check, Edit2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Modal, Input, CurrencyInput, Select,
  Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading,
  Badge,
} from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import {
  formatUzs,
  PermissionGroups, RolePermissions, UserRoleLabels,
  type UserRole,
} from "@ezoz/shared";
import toast from "react-hot-toast";

const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_YEAR = new Date().getFullYear();

type UserRole_T = "CASHIER_SALES" | "CASHIER_SERVICE" | "MASTER";

const roleOptions = [
  { value: "CASHIER_SALES", label: "Kassir (Savdo)" },
  { value: "CASHIER_SERVICE", label: "Kassir (Xizmat)" },
  { value: "MASTER", label: "Usta" },
];

const roleBadgeVariant: Record<string, "danger" | "warning" | "info" | "success"> = {
  BOSS: "danger",
  CASHIER_SALES: "info",
  CASHIER_SERVICE: "success",
  MASTER: "warning",
};

function getRoleDefaults(role: string): string[] {
  const r = role as UserRole;
  return [...(RolePermissions[r] || [])];
}

const monthNames = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

// ===== Main Page =====
export function EmployeesPage() {
  const { isBoss } = useAuth();
  const queryClient = useQueryClient();

  // Selection & modals
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Salary
  const [salaryMonth, setSalaryMonth] = useState(CURRENT_MONTH);
  const [salaryYear, setSalaryYear] = useState(CURRENT_YEAR);
  const [salaryResult, setSalaryResult] = useState<{
    baseSalary: number;
    totalBonus: number;
    totalAdvance: number;
    netPayment: number;
  } | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    username: "", fullName: "", password: "", phone: "",
    role: "CASHIER_SALES" as UserRole_T,
    baseSalaryUzs: "0", bonusPerJob: "0",
  });
  const [createPermissions, setCreatePermissions] = useState<string[]>(() => getRoleDefaults("CASHIER_SALES"));

  const [editForm, setEditForm] = useState({
    fullName: "", phone: "", role: "CASHIER_SALES" as UserRole_T,
    baseSalaryUzs: "0", bonusPerJob: "0",
  });
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const [advanceForm, setAdvanceForm] = useState({
    userId: "",
    amountUzs: "0",
    cashRegister: "SALES" as "SALES" | "SERVICE",
    notes: "",
  });

  const [jobForm, setJobForm] = useState({
    userId: "",
    description: "",
    bonusUzs: "0",
  });

  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });

  // ===== Queries =====
  const listQuery = useQuery({
    queryKey: ["employee", "list"],
    queryFn: () => trpc.employee.list.query(),
  });

  const detailQuery = useQuery({
    queryKey: ["employee", "detail", selectedId],
    queryFn: () => trpc.employee.getById.query({ id: selectedId! }),
    enabled: selectedId !== null,
  });

  // ===== Mutations =====
  const createUser = useMutation({
    mutationFn: () =>
      trpc.auth.createUser.mutate({
        username: createForm.username,
        password: createForm.password,
        fullName: createForm.fullName,
        phone: createForm.phone || undefined,
        role: createForm.role,
        baseSalaryUzs: Number(createForm.baseSalaryUzs),
        bonusPerJob: Number(createForm.bonusPerJob),
        customPermissions: createPermissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Xodim qo'shildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUser = useMutation({
    mutationFn: () =>
      trpc.auth.updateUser.mutate({
        id: selectedId!,
        fullName: editForm.fullName,
        phone: editForm.phone || null,
        role: editForm.role,
        baseSalaryUzs: Number(editForm.baseSalaryUzs),
        bonusPerJob: Number(editForm.bonusPerJob),
        customPermissions: editPermissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      setEditOpen(false);
      toast.success("Saqlandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateUser = useMutation({
    mutationFn: (id: number) => trpc.auth.updateUser.mutate({ id, isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      setSelectedId(null);
      toast.success("Xodim o'chirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const addAdvance = useMutation({
    mutationFn: () =>
      trpc.employee.addAdvance.mutate({
        userId: Number(advanceForm.userId),
        amountUzs: Number(advanceForm.amountUzs),
        cashRegister: advanceForm.cashRegister,
        notes: advanceForm.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      setAdvanceOpen(false);
      setAdvanceForm({ userId: "", amountUzs: "0", cashRegister: "SALES", notes: "" });
      toast.success("Avans berildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const addJob = useMutation({
    mutationFn: () =>
      trpc.employee.addJobRecord.mutate({
        userId: Number(jobForm.userId),
        description: jobForm.description,
        bonusUzs: Number(jobForm.bonusUzs),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      setJobOpen(false);
      setJobForm({ userId: "", description: "", bonusUzs: "0" });
      toast.success("Ish qayd etildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const calculateSalary = useMutation({
    mutationFn: () =>
      trpc.employee.calculateSalary.query({
        userId: selectedId!,
        month: salaryMonth,
        year: salaryYear,
      }),
    onSuccess: (data) => setSalaryResult(data),
    onError: (err) => toast.error(err.message),
  });

  const paySalary = useMutation({
    mutationFn: () => {
      if (!salaryResult) throw new Error("Avval hisoblang");
      return trpc.employee.paySalary.mutate({
        userId: selectedId!,
        month: salaryMonth,
        year: salaryYear,
        ...salaryResult,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      setSalaryResult(null);
      toast.success("Oylik to'landi");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = useMutation({
    mutationFn: () =>
      trpc.auth.resetPassword.mutate({ userId: selectedId!, newPassword: passwords.newPassword }),
    onSuccess: () => {
      setPasswordOpen(false);
      setPasswords({ newPassword: "", confirmPassword: "" });
      toast.success("Parol o'zgartirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  // ===== Helpers =====
  const employees = listQuery.data ?? [];
  const empOptions = employees.map((e) => ({ value: String(e.id), label: e.fullName }));
  const detail = detailQuery.data;
  const totalAdvances = detail?.advances.reduce((s, a) => s + Number(a.amountUzs), 0) ?? 0;
  const totalBonuses = detail?.jobRecords.reduce((s, j) => s + Number(j.bonusUzs), 0) ?? 0;

  function resetCreateForm() {
    setCreateForm({
      username: "", fullName: "", password: "", phone: "",
      role: "CASHIER_SALES", baseSalaryUzs: "0", bonusPerJob: "0",
    });
    setCreatePermissions(getRoleDefaults("CASHIER_SALES"));
  }

  function openEdit(user: {
    id: number; fullName: string; phone: string | null; role: string;
    baseSalaryUzs: unknown; bonusPerJob: unknown;
    customPermissions?: string | null;
  }) {
    setSelectedId(user.id);
    setEditForm({
      fullName: user.fullName,
      phone: user.phone ?? "",
      role: user.role as UserRole_T,
      baseSalaryUzs: String(Number(user.baseSalaryUzs)),
      bonusPerJob: String(Number(user.bonusPerJob)),
    });
    let perms: string[] = [];
    if (user.customPermissions) {
      try { perms = JSON.parse(user.customPermissions); } catch { /* ignore */ }
    }
    if (perms.length === 0) perms = getRoleDefaults(user.role);
    setEditPermissions(perms);
    setEditOpen(true);
  }

  // ===== Render =====
  return (
    <>
      <PageHeader
        title="Xodimlar"
        actions={isBoss() && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAdvanceOpen(true)}>
              <Banknote className="w-4 h-4" />
              Avans
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setJobOpen(true)}>
              <Briefcase className="w-4 h-4" />
              Ish qayd
            </Button>
            <Button size="sm" onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
              <Plus className="w-4 h-4" />
              Yangi xodim
            </Button>
          </div>
        )}
      />

      <div className="page-body">
        <div className="flex gap-6">
          {/* ===== TABLE ===== */}
          <div className={`${selectedId ? "w-1/2" : "w-full"} transition-all`}>
            <Table>
              <TableHead>
                <tr>
                  <th>Ism</th>
                  <th>Lavozim</th>
                  <th>Telefon</th>
                  <th>Oylik (baza)</th>
                  <th>Bonus/ish</th>
                  {isBoss() && <th className="w-24">Amallar</th>}
                </tr>
              </TableHead>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableLoading colSpan={isBoss() ? 6 : 5} />
                ) : employees.length === 0 ? (
                  <TableEmpty colSpan={isBoss() ? 6 : 5} message="Xodimlar yo'q" />
                ) : (
                  employees.map((emp) => (
                    <TableRow
                      key={emp.id}
                      active={selectedId === emp.id}
                      onClick={() => {
                        setSelectedId(selectedId === emp.id ? null : emp.id);
                        setSalaryResult(null);
                      }}
                    >
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{emp.fullName}</p>
                          <p className="text-xs text-gray-400">@{emp.username}</p>
                        </div>
                      </td>
                      <td>
                        <Badge variant={roleBadgeVariant[emp.role] ?? "info"}>
                          {UserRoleLabels[emp.role as UserRole] || emp.role}
                        </Badge>
                      </td>
                      <td className="text-sm text-gray-500">{emp.phone || "-"}</td>
                      <td className="currency-uzs text-sm">{formatUzs(Number(emp.baseSalaryUzs))}</td>
                      <td className="text-sm text-gray-500">{formatUzs(Number(emp.bonusPerJob))}</td>
                      {isBoss() && (
                        <td>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {emp.role !== "BOSS" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} title="Tahrirlash">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setSelectedId(emp.id);
                                  setPasswords({ newPassword: "", confirmPassword: "" });
                                  setPasswordOpen(true);
                                }} title="Parol">
                                  <Key className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  if (confirm(`"${emp.fullName}" ni o'chirmoqchimisiz?`)) deactivateUser.mutate(emp.id);
                                }} title="O'chirish">
                                  <UserX className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </>
                            )}
                            {emp.role === "BOSS" && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                setSelectedId(emp.id);
                                setPasswords({ newPassword: "", confirmPassword: "" });
                                setPasswordOpen(true);
                              }} title="Parol">
                                <Key className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* ===== DETAIL PANEL ===== */}
          {selectedId && detail && (
            <div className="w-1/2">
              <div className="card sticky top-20">
                <div className="card-header">
                  <div>
                    <h3 className="font-semibold">{detail.fullName}</h3>
                    <p className="text-xs text-gray-500">
                      @{detail.username} | {UserRoleLabels[detail.role as UserRole] || detail.role} | {detail.phone || "Telefon yo'q"}
                    </p>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>

                <div className="card-body space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Baza oylik</p>
                      <p className="text-lg font-bold text-gray-900">{formatUzs(Number(detail.baseSalaryUzs))}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Bonus/ish</p>
                      <p className="text-lg font-bold text-gray-900">{formatUzs(Number(detail.bonusPerJob))}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        <p className="text-xs text-red-600">Jami avanslar</p>
                      </div>
                      <p className="text-lg font-bold text-red-600">{formatUzs(totalAdvances)}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <p className="text-xs text-green-600">Jami bonuslar</p>
                      </div>
                      <p className="text-lg font-bold text-green-600">{formatUzs(totalBonuses)}</p>
                    </div>
                  </div>

                  {/* Salary calculation */}
                  {isBoss() && (
                    <div className="border border-brand-200 bg-brand-50/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-brand-600" />
                        <h4 className="text-sm font-semibold text-brand-700">Oylik hisoblash</h4>
                      </div>
                      <div className="flex items-end gap-2">
                        <Select
                          label="Oy"
                          options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
                          value={String(salaryMonth)}
                          onChange={(e) => { setSalaryMonth(Number(e.target.value)); setSalaryResult(null); }}
                        />
                        <Input
                          label="Yil" type="number" value={String(salaryYear)} className="w-24"
                          onChange={(e) => { setSalaryYear(Number(e.target.value)); setSalaryResult(null); }}
                        />
                        <Button size="sm" loading={calculateSalary.isPending} onClick={() => calculateSalary.mutate()}>
                          <Calculator className="w-3.5 h-3.5" />
                          Hisoblash
                        </Button>
                      </div>

                      {salaryResult && (
                        <div className="mt-3 space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Baza oylik:</span>
                            <span className="font-medium">{formatUzs(salaryResult.baseSalary)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">+ Bonuslar:</span>
                            <span className="font-medium text-green-600">{formatUzs(salaryResult.totalBonus)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-600">- Avanslar:</span>
                            <span className="font-medium text-red-600">{formatUzs(salaryResult.totalAdvance)}</span>
                          </div>
                          <div className="border-t pt-1.5 flex justify-between">
                            <span className="font-semibold text-gray-900">To'lanadigan:</span>
                            <span className="font-bold text-lg text-brand-600">{formatUzs(salaryResult.netPayment)}</span>
                          </div>
                          <Button
                            size="sm" variant={salaryResult.netPayment > 0 ? "success" : "secondary"}
                            className="w-full mt-2" disabled={salaryResult.netPayment <= 0}
                            loading={paySalary.isPending} onClick={() => paySalary.mutate()}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Oylik to'lash
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Salary history */}
                  {detail.salaryPayments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Oylik tarixi
                      </h4>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {detail.salaryPayments.map((sp) => (
                          <div key={sp.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                            <span className="text-gray-600">{monthNames[sp.month - 1]} {sp.year}</span>
                            <span className="currency-uzs font-medium">{formatUzs(Number(sp.netPayment))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent advances */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">So'nggi avanslar</h4>
                    {detail.advances.length === 0 ? (
                      <p className="text-sm text-gray-400">Avanslar yo'q</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {detail.advances.slice(0, 10).map((a) => (
                          <div key={a.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                            <div>
                              <span className="text-gray-600">{new Date(a.givenAt).toLocaleDateString("uz")}</span>
                              {a.notes && <span className="text-gray-400 ml-2 text-xs">{a.notes}</span>}
                            </div>
                            <span className="currency-uzs">{formatUzs(Number(a.amountUzs))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent jobs */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">So'nggi ishlar</h4>
                    {detail.jobRecords.length === 0 ? (
                      <p className="text-sm text-gray-400">Ish qaydlari yo'q</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {detail.jobRecords.slice(0, 10).map((j) => (
                          <div key={j.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                            <div className="flex-1 min-w-0">
                              <span className="text-gray-600 truncate block max-w-[200px]">{j.description}</span>
                              <span className="text-xs text-gray-400">{new Date(j.date).toLocaleDateString("uz")}</span>
                            </div>
                            <span className="currency-uzs">{formatUzs(Number(j.bonusUzs))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== CREATE USER MODAL ===== */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yangi xodim" size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Bekor qilish</Button>
          <Button loading={createUser.isPending} onClick={() => {
            if (!createForm.username || !createForm.fullName || !createForm.password) {
              toast.error("Barcha majburiy maydonlarni to'ldiring"); return;
            }
            if (createForm.password.length < 4) { toast.error("Parol kamida 4 belgi bo'lsin"); return; }
            createUser.mutate();
          }}>
            <Plus className="w-4 h-4" />
            Qo'shish
          </Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Foydalanuvchi nomi *" value={createForm.username}
              onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} placeholder="kassir3" />
            <Input label="To'liq ism *" value={createForm.fullName}
              onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Aliyev Ali" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Parol *" type="password" value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            <Select label="Lavozim" options={roleOptions} value={createForm.role}
              onChange={(e) => {
                const role = e.target.value as UserRole_T;
                setCreateForm((f) => ({ ...f, role }));
                setCreatePermissions(getRoleDefaults(role));
              }} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Telefon" value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+998..." />
            <CurrencyInput label="Baza oylik" currency="UZS" value={createForm.baseSalaryUzs}
              onValueChange={(v) => setCreateForm((f) => ({ ...f, baseSalaryUzs: v }))} />
            <CurrencyInput label="Bonus/ish" currency="UZS" value={createForm.bonusPerJob}
              onValueChange={(v) => setCreateForm((f) => ({ ...f, bonusPerJob: v }))} />
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-600" />
              <h4 className="text-sm font-semibold text-gray-700">Ruxsatlar</h4>
              <span className="text-xs text-gray-400">({createPermissions.length} ta tanlangan)</span>
            </div>
            <PermissionsPanel selectedPermissions={createPermissions} onChange={setCreatePermissions} />
          </div>
        </div>
      </Modal>

      {/* ===== EDIT USER MODAL ===== */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Xodimni tahrirlash" size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setEditOpen(false)}>Bekor qilish</Button>
          <Button loading={updateUser.isPending} onClick={() => updateUser.mutate()}>
            <Save className="w-4 h-4" />
            Saqlash
          </Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="To'liq ism" value={editForm.fullName}
              onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} />
            <Select label="Lavozim" options={roleOptions} value={editForm.role}
              onChange={(e) => {
                const role = e.target.value as UserRole_T;
                setEditForm((f) => ({ ...f, role }));
                setEditPermissions(getRoleDefaults(role));
              }} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Telefon" value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            <CurrencyInput label="Baza oylik" currency="UZS" value={editForm.baseSalaryUzs}
              onValueChange={(v) => setEditForm((f) => ({ ...f, baseSalaryUzs: v }))} />
            <CurrencyInput label="Bonus/ish" currency="UZS" value={editForm.bonusPerJob}
              onValueChange={(v) => setEditForm((f) => ({ ...f, bonusPerJob: v }))} />
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-600" />
              <h4 className="text-sm font-semibold text-gray-700">Ruxsatlar</h4>
              <span className="text-xs text-gray-400">({editPermissions.length} ta tanlangan)</span>
            </div>
            <PermissionsPanel selectedPermissions={editPermissions} onChange={setEditPermissions} />
          </div>
        </div>
      </Modal>

      {/* ===== ADVANCE MODAL ===== */}
      <Modal open={advanceOpen} onClose={() => setAdvanceOpen(false)} title="Avans berish" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setAdvanceOpen(false)}>Bekor qilish</Button>
          <Button loading={addAdvance.isPending} onClick={() => {
            if (!advanceForm.userId || Number(advanceForm.amountUzs) <= 0) { toast.error("Xodim va summa kiriting"); return; }
            addAdvance.mutate();
          }}>Berish</Button>
        </>}
      >
        <div className="space-y-4">
          <Select label="Xodim" options={empOptions} value={advanceForm.userId}
            onChange={(e) => setAdvanceForm((f) => ({ ...f, userId: e.target.value }))} placeholder="Tanlang..." />
          <CurrencyInput label="Summa" currency="UZS" value={advanceForm.amountUzs}
            onValueChange={(v) => setAdvanceForm((f) => ({ ...f, amountUzs: v }))} />
          <Select label="Kassa" options={[{ value: "SALES", label: "Savdo" }, { value: "SERVICE", label: "Xizmat" }]}
            value={advanceForm.cashRegister}
            onChange={(e) => setAdvanceForm((f) => ({ ...f, cashRegister: e.target.value as "SALES" | "SERVICE" }))} />
          <Input label="Izoh" value={advanceForm.notes}
            onChange={(e) => setAdvanceForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* ===== JOB RECORD MODAL ===== */}
      <Modal open={jobOpen} onClose={() => setJobOpen(false)} title="Ish qayd qilish" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setJobOpen(false)}>Bekor qilish</Button>
          <Button loading={addJob.isPending} onClick={() => {
            if (!jobForm.userId || !jobForm.description) { toast.error("Xodim va tavsif kiriting"); return; }
            addJob.mutate();
          }}>Saqlash</Button>
        </>}
      >
        <div className="space-y-4">
          <Select label="Xodim" options={empOptions} value={jobForm.userId}
            onChange={(e) => setJobForm((f) => ({ ...f, userId: e.target.value }))} placeholder="Tanlang..." />
          <Input label="Ish tavsifi" value={jobForm.description}
            onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))} placeholder="Nima ish qildi" />
          <CurrencyInput label="Bonus" currency="UZS" value={jobForm.bonusUzs}
            onValueChange={(v) => setJobForm((f) => ({ ...f, bonusUzs: v }))} />
        </div>
      </Modal>

      {/* ===== PASSWORD MODAL ===== */}
      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Parolni o'zgartirish" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setPasswordOpen(false)}>Bekor qilish</Button>
          <Button loading={resetPassword.isPending} onClick={() => {
            if (passwords.newPassword.length < 4) { toast.error("Parol kamida 4 belgi bo'lsin"); return; }
            if (passwords.newPassword !== passwords.confirmPassword) { toast.error("Parollar mos kelmadi"); return; }
            resetPassword.mutate();
          }}>O'zgartirish</Button>
        </>}
      >
        <div className="space-y-4">
          <Input label="Yangi parol" type="password" value={passwords.newPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} />
          <Input label="Parolni tasdiqlash" type="password" value={passwords.confirmPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}

// ===== Permissions Panel =====
function PermissionsPanel({
  selectedPermissions,
  onChange,
}: {
  selectedPermissions: string[];
  onChange: (perms: string[]) => void;
}) {
  function togglePermission(key: string) {
    if (selectedPermissions.includes(key)) {
      onChange(selectedPermissions.filter((p) => p !== key));
    } else {
      onChange([...selectedPermissions, key]);
    }
  }

  function toggleGroup(groupPerms: string[], allSelected: boolean) {
    if (allSelected) {
      onChange(selectedPermissions.filter((p) => !groupPerms.includes(p)));
    } else {
      const newPerms = new Set([...selectedPermissions, ...groupPerms]);
      onChange([...newPerms]);
    }
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {PermissionGroups.map((group) => {
        const groupKeys = group.permissions.map((p) => p.key);
        const selectedCount = groupKeys.filter((k) => selectedPermissions.includes(k)).length;
        const allSelected = selectedCount === groupKeys.length;

        return (
          <div key={group.title} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(groupKeys, allSelected)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border flex items-center justify-center text-white text-[10px] ${
                  allSelected ? "bg-brand-600 border-brand-600" : selectedCount > 0 ? "bg-brand-300 border-brand-300" : "border-gray-300"
                }`}>
                  {(allSelected || selectedCount > 0) && <Check size={10} />}
                </div>
                <span className="text-sm font-medium text-gray-700">{group.title}</span>
              </div>
              <span className="text-xs text-gray-400">{selectedCount}/{groupKeys.length}</span>
            </button>
            <div className="px-3 py-2 space-y-1">
              {group.permissions.map((perm) => {
                const isSelected = selectedPermissions.includes(perm.key);
                return (
                  <label key={perm.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1">
                    <input type="checkbox" checked={isSelected} onChange={() => togglePermission(perm.key)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-gray-600">{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
