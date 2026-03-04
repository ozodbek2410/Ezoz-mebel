import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Truck, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, SearchInput, Modal, Input, Select, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading, Pagination, Badge, CurrencyPairInput, Tabs, SlideOver, PhoneInput } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { formatUzs, formatUsd } from "@ezoz/shared";
import toast from "react-hot-toast";
import { useT, getT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";

interface SupplierFormData {
  name: string;
  phone: string;
  notes: string;
  initialDebtUzs: string;
  initialDebtUsd: string;
}

const defaultForm: SupplierFormData = {
  name: "",
  phone: "",
  notes: "",
  initialDebtUzs: "0",
  initialDebtUsd: "0",
};

export function SuppliersPage() {
  const t = useT();
  const { can, isBoss } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierFormData>(defaultForm);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [slideForm, setSlideForm] = useState<SupplierFormData>(defaultForm);
  const [debtPayOpen, setDebtPayOpen] = useState(false);
  const [debtPayForm, setDebtPayForm] = useState({ amountUzs: "0", paymentType: "CASH_UZS", cashRegister: "SALES" });
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<number | null>(null);

  // Queries
  const listQuery = useQuery({
    queryKey: ["supplier", "list", page],
    queryFn: () => trpc.supplier.list.query({ page, limit: 50 }),
  });

  const searchQuery = useQuery({
    queryKey: ["supplier", "search", search],
    queryFn: () => trpc.supplier.search.query({ query: search }),
    enabled: search.length >= 2,
  });

  const detailQuery = useQuery({
    queryKey: ["supplier", "detail", detailId],
    queryFn: () => trpc.supplier.getById.query({ id: detailId! }),
    enabled: detailId !== null,
  });

  const debtQuery = useQuery({
    queryKey: ["supplier", "debt", detailId],
    queryFn: () => trpc.supplier.getDebtSummary.query({ id: detailId! }),
    enabled: detailId !== null,
  });

  const unpaidPurchasesQuery = useQuery({
    queryKey: ["supplier", "unpaidPurchases", detailId],
    queryFn: () => trpc.supplier.getUnpaidPurchases.query({ id: detailId! }),
    enabled: detailId !== null && detailTab === "debt",
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) =>
      trpc.supplier.create.mutate({
        name: data.name,
        phone: data.phone || undefined,
        notes: data.notes || undefined,
        initialDebtUzs: Number(data.initialDebtUzs),
        initialDebtUsd: Number(data.initialDebtUsd),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      closeModal();
      toast.success(getT()("Ta'minotchi qo'shildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: SupplierFormData & { id: number }) =>
      trpc.supplier.update.mutate({
        id: data.id,
        name: data.name,
        phone: data.phone || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      setDetailId(null);
      toast.success(getT()("Ta'minotchi yangilandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trpc.supplier.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      setDetailId(null);
      toast.success(getT()("Ta'minotchi o'chirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const payDebtMutation = useMutation({
    mutationFn: () =>
      trpc.supplier.payDebt.mutate({
        supplierId: detailId!,
        amountUzs: Number(debtPayForm.amountUzs),
        amountUsd: 0,
        paymentType: debtPayForm.paymentType as "CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER",
        cashRegister: debtPayForm.cashRegister as "SALES" | "SERVICE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      setDebtPayOpen(false);
      setDebtPayForm({ amountUzs: "0", paymentType: "CASH_UZS", cashRegister: "SALES" });
      toast.success(getT()("Qarz to'landi"));
    },
    onError: (err) => toast.error(err.message),
  });

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }

  function openEdit(supplier: { id: number; name: string; phone: string | null; notes: string | null; initialDebtUzs: unknown; initialDebtUsd: unknown }) {
    setEditing(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone || "",
      notes: supplier.notes || "",
      initialDebtUzs: String(supplier.initialDebtUzs),
      initialDebtUsd: String(supplier.initialDebtUsd),
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!form.name) {
      toast.error(getT()("Nom kiritilmadi"));
      return;
    }
    if (editing) {
      updateMutation.mutate({ ...form, id: editing });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleSlideFormSave() {
    if (!slideForm.name) {
      toast.error(getT()("Nom kiritilmadi"));
      return;
    }
    if (detailId) {
      updateMutation.mutate({ ...slideForm, id: detailId });
    }
  }

  const suppliers = search.length >= 2 ? (searchQuery.data ?? []) : (listQuery.data?.suppliers ?? []);
  const totalPages = search.length >= 2 ? 1 : Math.ceil((listQuery.data?.total ?? 0) / 50);
  const detail = detailQuery.data;
  const debt = debtQuery.data;

  // Sync slideForm with detail data
  useEffect(() => {
    if (detail) {
      setSlideForm({
        name: detail.name,
        phone: detail.phone || "",
        notes: detail.notes || "",
        initialDebtUzs: String(detail.initialDebtUzs),
        initialDebtUsd: String(detail.initialDebtUsd),
      });
    }
  }, [detail]);

  return (
    <div className="page-enter">
      <PageHeader
        title={t("Ta'minotchilar")}
        subtitle={`${listQuery.data?.total ?? 0} ${t("ta ta'minotchi")}`}
        actions={
          (isBoss() || can("supplier:manage")) ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setForm(defaultForm);
                setModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              {t("Yangi ta'minotchi")}
            </Button>
          ) : undefined
        }
      />

      <div className="page-body">
        <div className="flex gap-6">
          <div className="w-full">
            <div className="mb-4">
              <SearchInput
                placeholder={t("Ta'minotchi qidirish (nom yoki telefon)...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <th>#</th>
                    <th>{t("Nomi")}</th>
                    <th className="hidden sm:table-cell">{t("Telefon")}</th>
                    <th className="hidden md:table-cell">{t("Izoh")}</th>
                    <th className="hidden md:table-cell text-center">{t("Kirimlar")}</th>
                    <th className="w-20">{t("Amallar")}</th>
                  </tr>
                </TableHead>
                <TableBody>
                  {listQuery.isLoading ? (
                    <TableLoading colSpan={6} />
                  ) : suppliers.length === 0 ? (
                    <TableEmpty colSpan={6} message={t("Ta'minotchi topilmadi")} />
                  ) : (
                    suppliers.map((s, idx) => (
                      <TableRow
                        key={s.id}
                        active={detailId === s.id}
                        onClick={() => setDetailId(detailId === s.id ? null : s.id)}
                      >
                        <td className="text-slate-400 text-xs">{(page - 1) * 50 + idx + 1}</td>
                        <td>
                          <span className="font-medium text-slate-900">{s.name}</span>
                        </td>
                        <td className="text-slate-500 hidden sm:table-cell">{s.phone || "-"}</td>
                        <td className="text-slate-400 text-xs hidden md:table-cell max-w-[200px] truncate">{s.notes || "-"}</td>
                        <td className="hidden md:table-cell text-center">
                          {"_count" in s ? (
                            <Badge variant="neutral">{(s._count as { purchases: number }).purchases}</Badge>
                          ) : "-"}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {(isBoss() || can("supplier:manage")) && (
                              <>
                                <button
                                  className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                                  onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                                <button
                                  className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(getT()(`"${s.name}" ni o'chirmoqchimisiz?`))) {
                                      deleteMutation.mutate(s.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t("Ta'minotchini tahrirlash") : t("Yangi ta'minotchi")}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              {t("Bekor qilish")}
            </Button>
            <Button
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {editing ? t("Saqlash") : t("Qo'shish")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t("Nomi (ism yoki kompaniya)")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("Masalan: Ali aka, MDF Market")}
          />
          <PhoneInput
            label={t("Telefon")}
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          />
          {!editing && (
            <div className="border-t pt-4">
              <CurrencyPairInput
                label={t("Boshlang'ich qarz (bizdan ularga)")}
                valueUzs={form.initialDebtUzs}
                valueUsd={form.initialDebtUsd}
                onChangeUzs={(v) => setForm((f) => ({ ...f, initialDebtUzs: v }))}
                onChangeUsd={(v) => setForm((f) => ({ ...f, initialDebtUsd: v }))}
              />
            </div>
          )}
          <Input
            label={t("Izoh")}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Detail SlideOver */}
      <SlideOver
        open={detailId !== null && !!detail}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? ""}
        width="3xl"
        headerLeft={
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-emerald-600" />
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            {(isBoss() || can("supplier:manage")) ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (detailId && confirm(getT()("Bu ta'minotchini o'chirmoqchimisiz?"))) {
                    deleteMutation.mutate(detailId);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("O'chirish")}
              </Button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDetailId(null)}>
                {t("Bekor qilish")}
              </Button>
              {(isBoss() || can("supplier:manage")) && (
                <Button size="sm" loading={updateMutation.isPending} onClick={handleSlideFormSave}>
                  {t("Saqlash")}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {detail && (
          <div>
            <Tabs
              tabs={[
                { id: "info", label: t("Ma'lumot") },
                { id: "debt", label: t("Qarz") },
                { id: "purchases", label: t("Kirimlar"), count: detail.purchases.length },
              ]}
              activeTab={detailTab}
              onChange={setDetailTab}
            />

            <div className="p-6">
              {detailTab === "info" && (
                <div className="space-y-4">
                  <Input
                    label={t("Nomi")}
                    value={slideForm.name}
                    onChange={(e) => setSlideForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <PhoneInput
                    label={t("Telefon")}
                    value={slideForm.phone}
                    onChange={(v) => setSlideForm((f) => ({ ...f, phone: v }))}
                  />
                  <Input
                    label={t("Izoh")}
                    value={slideForm.notes}
                    onChange={(e) => setSlideForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              )}

              {detailTab === "debt" && debt && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="bg-red-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t("Bizning qarzimiz")}</p>
                      <p className="text-xl font-bold text-red-600">{formatUzs(debt.totalDebtUzs)}</p>
                      {debt.totalDebtUsd > 0 && <p className="text-xs text-blue-600">{formatUsd(debt.totalDebtUsd)}</p>}
                    </div>
                    <Button size="sm" onClick={() => { setDebtPayForm({ amountUzs: "0", paymentType: "CASH_UZS", cashRegister: "SALES" }); setDebtPayOpen(true); }}>
                      {t("Qarz to'lash")}
                    </Button>
                  </div>

                  {/* Breakdown */}
                  <div className="text-xs text-slate-500 space-y-1 border rounded-lg px-3 py-2">
                    <div className="flex justify-between">
                      <span>{t("Boshlang'ich qarz:")}</span>
                      <span>{formatUzs(debt.initialDebtUzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("Jami kirimlar:")}</span>
                      <span>+{formatUzs(debt.totalPurchasesUzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("Jami to'langan:")}</span>
                      <span className="text-green-600">-{formatUzs(debt.totalPaidUzs)}</span>
                    </div>
                  </div>

                  {/* Unpaid purchases */}
                  {unpaidPurchasesQuery.data && unpaidPurchasesQuery.data.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-2">{t("To'lanmagan kirimlar")}</p>
                      <div className="space-y-1.5">
                        {unpaidPurchasesQuery.data.map((purchase) => (
                          <div key={purchase.id}>
                            <button
                              type="button"
                              className="w-full flex justify-between items-center px-3 py-2 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs transition-colors cursor-pointer"
                              onClick={() => setExpandedPurchaseId(expandedPurchaseId === purchase.id ? null : purchase.id)}
                            >
                              <span className="flex items-center gap-1.5">
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedPurchaseId === purchase.id ? "rotate-180" : ""}`} />
                                <span className="text-slate-500">{new Date(purchase.createdAt).toLocaleDateString("uz")}</span>
                              </span>
                              <span className="text-slate-500">{t("Jami:")} {formatUzs(purchase.totalUzs)}</span>
                              <span className="font-bold text-amber-700">{t("Qarz:")} {formatUzs(purchase.debtUzs)}</span>
                            </button>
                            {expandedPurchaseId === purchase.id && (
                              <div className="ml-5 mt-1 mb-1 border-l-2 border-amber-200 pl-3 space-y-1">
                                {purchase.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-slate-600">
                                    <span>{item.name} <span className="text-slate-400">x{item.quantity}</span></span>
                                    <span>{formatUzs(item.priceUzs * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment history */}
                  {detail.payments.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-2">{t("To'lovlar tarixi")}</p>
                      <div className="space-y-1.5">
                        {detail.payments.map((p) => (
                          <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-green-50 rounded-lg text-xs">
                            <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString("uz")}</span>
                            <span className="text-slate-500">
                              {p.paymentType === "CASH_UZS" ? t("Naqd (UZS)") : p.paymentType === "CASH_USD" ? t("Naqd ($)") : p.paymentType === "CARD" ? t("Karta") : t("O'tkazma")}
                            </span>
                            <span className="font-bold text-green-700">{formatUzs(Number(p.amountUzs))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "purchases" && (
                <div className="space-y-2">
                  {detail.purchases.length === 0 ? (
                    <EmptyState title={t("Kirimlar yo'q")} description={t("Bu ta'minotchidan hali kirim qilinmagan")} />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="neutral">
                          {t("Jami")}: {detail.purchases.length}
                        </Badge>
                      </div>
                      {detail.purchases.map((purchase) => (
                        <div key={purchase.id}>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer bg-blue-50 hover:bg-blue-100 border border-blue-100"
                            onClick={() => setExpandedPurchaseId(expandedPurchaseId === purchase.id ? null : purchase.id)}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedPurchaseId === purchase.id ? "rotate-180" : ""}`} />
                              <div className="text-left">
                                <p className="text-xs font-medium text-slate-700">#{purchase.documentNo.slice(-6)}</p>
                                <p className="text-xs text-slate-500">
                                  {new Date(purchase.createdAt).toLocaleDateString("uz")}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-red-600">{formatUzs(Number(purchase.totalUzs))}</p>
                              {Number(purchase.totalUsd) > 0 && (
                                <p className="text-xs text-blue-600">{formatUsd(Number(purchase.totalUsd))}</p>
                              )}
                            </div>
                          </button>
                          {expandedPurchaseId === purchase.id && (
                            <div className="ml-6 mt-1 mb-1 border-l-2 border-slate-200 pl-3 space-y-1">
                              {purchase.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs text-slate-600 py-0.5">
                                  <span>
                                    {item.product?.name ?? "—"}
                                    <span className="text-slate-400 ml-1">x{Number(item.quantity)}</span>
                                  </span>
                                  <span>{formatUzs(Number(item.priceUzs) * Number(item.quantity))}</span>
                                </div>
                              ))}
                              {purchase.payments.length > 0 && (
                                <div className="border-t border-slate-200 pt-1 mt-1">
                                  {purchase.payments.map((p, idx) => (
                                    <div key={idx} className="flex justify-between text-xs text-green-600 py-0.5">
                                      <span>
                                        {p.paymentType === "CASH_UZS" ? t("Naqd") : p.paymentType === "CARD" ? t("Karta") : t("O'tkazma")}
                                        {" "}{new Date(p.createdAt).toLocaleDateString("uz")}
                                      </span>
                                      <span>{formatUzs(Number(p.amountUzs))}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      {/* Pay debt modal */}
      <Modal
        open={debtPayOpen}
        onClose={() => setDebtPayOpen(false)}
        title={t("Ta'minotchi qarzini to'lash")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDebtPayOpen(false)}>{t("Bekor")}</Button>
            <Button
              variant="success"
              loading={payDebtMutation.isPending}
              onClick={() => {
                if (Number(debtPayForm.amountUzs) <= 0) { toast.error(getT()("Summani kiriting")); return; }
                payDebtMutation.mutate();
              }}
            >
              {t("Tasdiqlash")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t("Summa (UZS)")}
            type="number"
            min="0"
            value={debtPayForm.amountUzs}
            onChange={(e) => setDebtPayForm((f) => ({ ...f, amountUzs: e.target.value }))}
            rightIcon={<span className="text-xs">so'm</span>}
          />
          <Select
            label={t("To'lov turi")}
            options={[
              { value: "CASH_UZS", label: t("Naqd (UZS)") },
              { value: "CASH_USD", label: t("Naqd ($)") },
              { value: "CARD", label: t("Karta") },
              { value: "TRANSFER", label: t("O'tkazma") },
            ]}
            value={debtPayForm.paymentType}
            onChange={(e) => setDebtPayForm((f) => ({ ...f, paymentType: e.target.value }))}
          />
          <Select
            label={t("Kassa")}
            options={[
              { value: "SALES", label: t("Savdo kassasi") },
              { value: "SERVICE", label: t("Xizmat kassasi") },
            ]}
            value={debtPayForm.cashRegister}
            onChange={(e) => setDebtPayForm((f) => ({ ...f, cashRegister: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
