import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, SearchInput, Modal, Input, Select, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading, Pagination, Badge, CurrencyPairInput, Tabs, SlideOver, PhoneInput } from "@/components/ui";
import { CurrencyDisplay, EmptyState } from "@/components/shared";
import { formatUzs, formatUsd } from "@ezoz/shared";
import toast from "react-hot-toast";
import { useT, getT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";

interface CustomerFormData {
  fullName: string;
  phone: string;
  phone2: string;
  birthday: string;
  address: string;
  category: "REGULAR" | "MASTER";
  initialDebtUzs: string;
  initialDebtUsd: string;
  notes: string;
}

const defaultForm: CustomerFormData = {
  fullName: "",
  phone: "",
  phone2: "",
  birthday: "",
  address: "",
  category: "REGULAR",
  initialDebtUzs: "0",
  initialDebtUsd: "0",
  notes: "",
};

export function CustomersPage() {
  const t = useT();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerFormData>(defaultForm);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [slideForm, setSlideForm] = useState<CustomerFormData>(defaultForm);
  const [debtPayOpen, setDebtPayOpen] = useState(false);
  const [debtPayForm, setDebtPayForm] = useState({ amountUzs: "0", paymentType: "CASH_UZS" });
  const [manualDebtOpen, setManualDebtOpen] = useState(false);
  const [manualDebtAmount, setManualDebtAmount] = useState("0");

  // Queries
  const listQuery = useQuery({
    queryKey: ["customer", "list", page],
    queryFn: () => trpc.customer.list.query({ page, limit: 50 }),
  });

  const searchQuery = useQuery({
    queryKey: ["customer", "search", search],
    queryFn: () => trpc.customer.search.query({ query: search }),
    enabled: search.length >= 2,
  });

  const detailQuery = useQuery({
    queryKey: ["customer", "detail", detailId],
    queryFn: () => trpc.customer.getById.query({ id: detailId! }),
    enabled: detailId !== null,
  });

  const debtQuery = useQuery({
    queryKey: ["customer", "debt", detailId],
    queryFn: () => trpc.customer.getDebtSummary.query({ id: detailId! }),
    enabled: detailId !== null,
  });

  const unpaidSalesQuery = useQuery({
    queryKey: ["customer", "unpaidSales", detailId],
    queryFn: () => trpc.customer.getUnpaidSales.query({ id: detailId! }),
    enabled: detailId !== null && detailTab === "debt",
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) =>
      trpc.customer.create.mutate({
        fullName: data.fullName,
        phone: data.phone || undefined,
        phone2: data.phone2 || undefined,
        birthday: data.birthday || undefined,
        address: data.address || undefined,
        category: data.category,
        initialDebtUzs: Number(data.initialDebtUzs),
        initialDebtUsd: Number(data.initialDebtUsd),
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      closeModal();
      toast.success(getT()("Mijoz qo'shildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormData & { id: number }) =>
      trpc.customer.update.mutate({
        id: data.id,
        fullName: data.fullName,
        phone: data.phone || undefined,
        phone2: data.phone2 || undefined,
        birthday: data.birthday || undefined,
        address: data.address || undefined,
        category: data.category,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      setDetailId(null);
      toast.success(getT()("Mijoz yangilandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trpc.customer.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      setDetailId(null);
      toast.success(getT()("Mijoz o'chirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const payDebtMutation = useMutation({
    mutationFn: () =>
      trpc.payment.create.mutate({
        customerId: detailId!,
        amountUzs: Number(debtPayForm.amountUzs),
        amountUsd: 0,
        paymentType: debtPayForm.paymentType as "CASH_UZS" | "CARD" | "TRANSFER",
        source: "OLD_DEBT",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      setDebtPayOpen(false);
      setDebtPayForm({ amountUzs: "0", paymentType: "CASH_UZS" });
      toast.success(getT()("Qarz to'landi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const addManualDebtMutation = useMutation({
    mutationFn: () =>
      trpc.customer.addManualDebt.mutate({ id: detailId!, amountUzs: Number(manualDebtAmount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      setManualDebtOpen(false);
      setManualDebtAmount("0");
      toast.success(getT()("Qarz qo'shildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }

  function openEdit(customer: NonNullable<typeof listQuery.data>["customers"][number]) {
    setEditing(customer.id);
    setForm({
      fullName: customer.fullName,
      phone: customer.phone || "",
      phone2: customer.phone2 || "",
      birthday: customer.birthday ? new Date(customer.birthday).toISOString().split("T")[0]! : "",
      address: customer.address || "",
      category: customer.category as "REGULAR" | "MASTER",
      initialDebtUzs: String(customer.initialDebtUzs),
      initialDebtUsd: String(customer.initialDebtUsd),
      notes: customer.notes || "",
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!form.fullName) {
      toast.error(getT()("Ism kiritilmadi"));
      return;
    }
    if (editing) {
      updateMutation.mutate({ ...form, id: editing });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleSlideFormSave() {
    if (!slideForm.fullName) {
      toast.error(getT()("Ism kiritilmadi"));
      return;
    }
    if (detailId) {
      updateMutation.mutate({ ...slideForm, id: detailId });
    }
  }

  const customers = search.length >= 2 ? (searchQuery.data ?? []) : (listQuery.data?.customers ?? []);
  const totalPages = search.length >= 2 ? 1 : Math.ceil((listQuery.data?.total ?? 0) / 50);
  const detail = detailQuery.data;
  const debt = debtQuery.data;

  // Sync slideForm with detail data
  useEffect(() => {
    if (detail) {
      setSlideForm({
        fullName: detail.fullName,
        phone: detail.phone || "",
        phone2: detail.phone2 || "",
        birthday: detail.birthday ? new Date(detail.birthday).toISOString().split("T")[0]! : "",
        address: detail.address || "",
        category: detail.category as "REGULAR" | "MASTER",
        initialDebtUzs: String(detail.initialDebtUzs),
        initialDebtUsd: String(detail.initialDebtUsd),
        notes: detail.notes || "",
      });
    }
  }, [detail]);

  return (
    <>
      <PageHeader
        title={t("Mijozlar")}
        subtitle={`${listQuery.data?.total ?? 0} ${t("ta mijoz")}`}
        actions={
          can("customer:create") ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setForm(defaultForm);
                setModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              {t("Yangi mijoz")}
            </Button>
          ) : undefined
        }
      />

      <div className="page-body">
        <div className="flex gap-6">
          {/* Customer list */}
          <div className="w-full">
            <div className="mb-4">
              <SearchInput
                placeholder={t("Mijoz qidirish (ism yoki telefon)...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <tr>
                  <th>{t("Ism")}</th>
                  <th className="hidden sm:table-cell">{t("Telefon")}</th>
                  <th className="hidden md:table-cell">{t("Kategoriya")}</th>
                  <th className="w-20">{t("Amallar")}</th>
                </tr>
              </TableHead>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableLoading colSpan={5} />
                ) : customers.length === 0 ? (
                  <TableEmpty colSpan={5} message={t("Mijoz topilmadi")} />
                ) : (
                  customers.map((c) => (
                    <TableRow
                      key={c.id}
                      active={detailId === c.id}
                      onClick={() => setDetailId(detailId === c.id ? null : c.id)}
                    >
                      <td>
                        <span className="font-medium text-gray-900">{c.fullName}</span>
                      </td>
                      <td className="text-gray-500 hidden sm:table-cell">{c.phone || "-"}</td>
                      <td className="hidden md:table-cell">
                        <Badge variant={c.category === "MASTER" ? "info" : "neutral"}>
                          {c.category === "MASTER" ? t("Usta") : t("Oddiy")}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {can("customer:update") && (
                            <button
                              className="p-1.5 hover:bg-gray-100 rounded-lg"
                              onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                            >
                              <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          )}
                          {can("customer:delete") && (
                            <button
                              className="p-1.5 hover:bg-red-50 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(getT()(`"${c.fullName}" ni o'chirmoqchimisiz?`))) {
                                  deleteMutation.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
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

      {/* Customer Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t("Mijozni tahrirlash") : t("Yangi mijoz")}
        size="lg"
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
            label={t("To'liq ism")}
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder={t("Ism Familiya")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PhoneInput
              label={t("Telefon")}
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <PhoneInput
              label={t("Telefon 2 (ixtiyoriy)")}
              value={form.phone2}
              onChange={(v) => setForm((f) => ({ ...f, phone2: v }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("Tug'ilgan sana")}
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
            />
            <Select
              label={t("Kategoriya")}
              options={[
                { value: "REGULAR", label: t("Oddiy mijoz") },
                { value: "MASTER", label: t("Usta") },
              ]}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as "REGULAR" | "MASTER" }))}
            />
          </div>
          <Input
            label={t("Manzil")}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          {!editing && (
            <div className="border-t pt-4">
              <CurrencyPairInput
                label={t("Boshlang'ich qarz")}
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

      {/* Customer Detail SlideOver */}
      <SlideOver
        open={detailId !== null && !!detail}
        onClose={() => setDetailId(null)}
        title={detail?.fullName ?? ""}
        headerLeft={
          <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-brand-600" />
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            {can("customer:delete") ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (detailId && confirm(getT()("Bu mijozni o'chirmoqchimisiz?"))) {
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
              {can("customer:update") && (
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
                { id: "sales", label: t("Sotuvlar"), count: detail.sales.length },
              ]}
              activeTab={detailTab}
              onChange={setDetailTab}
            />

            <div className="p-6">
              {detailTab === "info" && (
                <div className="space-y-4">
                  <Input
                    label={t("To'liq ism")}
                    value={slideForm.fullName}
                    onChange={(e) => setSlideForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PhoneInput
                      label={t("Telefon")}
                      value={slideForm.phone}
                      onChange={(v) => setSlideForm((f) => ({ ...f, phone: v }))}
                    />
                    <PhoneInput
                      label={t("Telefon 2")}
                      value={slideForm.phone2}
                      onChange={(v) => setSlideForm((f) => ({ ...f, phone2: v }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label={t("Tug'ilgan sana")}
                      type="date"
                      value={slideForm.birthday}
                      onChange={(e) => setSlideForm((f) => ({ ...f, birthday: e.target.value }))}
                    />
                    <Select
                      label={t("Kategoriya")}
                      options={[
                        { value: "REGULAR", label: t("Oddiy mijoz") },
                        { value: "MASTER", label: t("Usta") },
                      ]}
                      value={slideForm.category}
                      onChange={(e) => setSlideForm((f) => ({ ...f, category: e.target.value as "REGULAR" | "MASTER" }))}
                    />
                  </div>
                  <Input
                    label={t("Manzil")}
                    value={slideForm.address}
                    onChange={(e) => setSlideForm((f) => ({ ...f, address: e.target.value }))}
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
                      <p className="text-xs text-gray-500">{t("Jami qarz")}</p>
                      <p className="text-xl font-bold text-red-600">{formatUzs(debt.totalDebtUzs)}</p>
                      {debt.totalDebtUsd > 0 && <p className="text-xs text-blue-600">{formatUsd(debt.totalDebtUsd)}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button size="sm" onClick={() => { setDebtPayForm({ amountUzs: "0", paymentType: "CASH_UZS" }); setDebtPayOpen(true); }}>
                        {t("Qarz to'lash")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setManualDebtAmount("0"); setManualDebtOpen(true); }}>
                        {t("Qarz qo'shish")}
                      </Button>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="text-xs text-gray-500 space-y-1 border rounded-lg px-3 py-2">
                    <div className="flex justify-between">
                      <span>{t("Boshlang'ich qarz:")}</span>
                      <span>{formatUzs(debt.initialDebtUzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("Jami sotuvlar:")}</span>
                      <span>+{formatUzs(debt.totalSalesUzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("Jami to'langan:")}</span>
                      <span className="text-green-600">-{formatUzs(debt.totalPaidUzs)}</span>
                    </div>
                  </div>

                  {/* Unpaid sales */}
                  {unpaidSalesQuery.data && unpaidSalesQuery.data.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">{t("Qarzli sotuvlar")}</p>
                      <div className="space-y-1.5">
                        {unpaidSalesQuery.data.map((sale) => (
                          <div key={sale.id} className="flex justify-between items-center px-3 py-2 bg-amber-50 rounded-lg text-xs">
                            <span className="text-gray-500">{new Date(sale.createdAt).toLocaleDateString("uz")}</span>
                            <span className="text-gray-500">{t("Jami:")} {formatUzs(sale.totalUzs)}</span>
                            <span className="font-bold text-amber-700">{t("Qarz:")} {formatUzs(sale.debtUzs)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debt payment history */}
                  {detail.payments.filter((p) => p.source === "OLD_DEBT").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">{t("Qarz to'lovlari")}</p>
                      <div className="space-y-1.5">
                        {detail.payments.filter((p) => p.source === "OLD_DEBT").map((p) => (
                          <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-green-50 rounded-lg text-xs">
                            <span className="text-gray-500">{new Date(p.createdAt).toLocaleDateString("uz")}</span>
                            <span className="text-gray-500">{p.paymentType === "CASH_UZS" ? t("Naqd") : p.paymentType === "CARD" ? t("Karta") : t("O'tkazma")}</span>
                            <span className="font-bold text-green-700">{formatUzs(Number(p.amountUzs))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "sales" && (
                <div className="space-y-2">
                  {detail.sales.length === 0 ? (
                    <EmptyState title={t("Sotuvlar yo'q")} description={t("Bu mijoz hali xarid qilmagan")} />
                  ) : (
                    detail.sales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">
                            {sale.saleType === "PRODUCT" ? t("Savdo") : t("Xizmat")}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(sale.createdAt).toLocaleDateString("uz")}
                          </p>
                        </div>
                        <CurrencyDisplay amountUzs={sale.totalUzs} amountUsd={sale.totalUsd} size="sm" />
                      </div>
                    ))
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
        title={t("Qarz to'lash")}
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
              { value: "CASH_UZS", label: t("Naqd") },
              { value: "CARD", label: t("Karta") },
              { value: "TRANSFER", label: t("O'tkazma") },
            ]}
            value={debtPayForm.paymentType}
            onChange={(e) => setDebtPayForm((f) => ({ ...f, paymentType: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Add manual debt modal */}
      <Modal
        open={manualDebtOpen}
        onClose={() => setManualDebtOpen(false)}
        title={t("Qarz qo'shish")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setManualDebtOpen(false)}>{t("Bekor")}</Button>
            <Button
              variant="danger"
              loading={addManualDebtMutation.isPending}
              onClick={() => {
                if (Number(manualDebtAmount) <= 0) { toast.error(getT()("Summani kiriting")); return; }
                addManualDebtMutation.mutate();
              }}
            >
              {t("Qarz qo'shish")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t("Summa (UZS)")}
            type="number"
            min="0"
            value={manualDebtAmount}
            onChange={(e) => setManualDebtAmount(e.target.value)}
            rightIcon={<span className="text-xs">so'm</span>}
          />
        </div>
      </Modal>
    </>
  );
}
