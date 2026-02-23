import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, SearchInput, Modal, Input, Select, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading, Pagination, Badge, CurrencyPairInput, Tabs, SlideOver, PhoneInput } from "@/components/ui";
import { CurrencyDisplay, EmptyState } from "@/components/shared";
import { formatUzs, formatUsd } from "@ezoz/shared";
import toast from "react-hot-toast";

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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerFormData>(defaultForm);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [slideForm, setSlideForm] = useState<CustomerFormData>(defaultForm);

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
      toast.success("Mijoz qo'shildi");
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
      toast.success("Mijoz yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trpc.customer.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      setDetailId(null);
      toast.success("Mijoz o'chirildi");
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
      toast.error("Ism kiritilmadi");
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
      toast.error("Ism kiritilmadi");
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
        title="Mijozlar"
        subtitle={`${listQuery.data?.total ?? 0} ta mijoz`}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm(defaultForm);
              setModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Yangi mijoz
          </Button>
        }
      />

      <div className="page-body">
        <div className="flex gap-6">
          {/* Customer list */}
          <div className="w-full">
            <div className="mb-4">
              <SearchInput
                placeholder="Mijoz qidirish (ism yoki telefon)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <tr>
                  <th>Ism</th>
                  <th className="hidden sm:table-cell">Telefon</th>
                  <th className="hidden md:table-cell">Kategoriya</th>
                  <th className="w-20">Amallar</th>
                </tr>
              </TableHead>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableLoading colSpan={5} />
                ) : customers.length === 0 ? (
                  <TableEmpty colSpan={5} message="Mijoz topilmadi" />
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
                          {c.category === "MASTER" ? "Usta" : "Oddiy"}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 hover:bg-gray-100 rounded-lg"
                            onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            className="p-1.5 hover:bg-red-50 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`"${c.fullName}" ni o'chirmoqchimisiz?`)) {
                                deleteMutation.mutate(c.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
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
        title={editing ? "Mijozni tahrirlash" : "Yangi mijoz"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Bekor qilish
            </Button>
            <Button
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="To'liq ism"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Ism Familiya"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PhoneInput
              label="Telefon"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <PhoneInput
              label="Telefon 2 (ixtiyoriy)"
              value={form.phone2}
              onChange={(v) => setForm((f) => ({ ...f, phone2: v }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tug'ilgan sana"
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
            />
            <Select
              label="Kategoriya"
              options={[
                { value: "REGULAR", label: "Oddiy mijoz" },
                { value: "MASTER", label: "Usta" },
              ]}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as "REGULAR" | "MASTER" }))}
            />
          </div>
          <Input
            label="Manzil"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          {!editing && (
            <div className="border-t pt-4">
              <CurrencyPairInput
                label="Boshlang'ich qarz"
                valueUzs={form.initialDebtUzs}
                valueUsd={form.initialDebtUsd}
                onChangeUzs={(v) => setForm((f) => ({ ...f, initialDebtUzs: v }))}
                onChangeUsd={(v) => setForm((f) => ({ ...f, initialDebtUsd: v }))}
              />
            </div>
          )}
          <Input
            label="Izoh"
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
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (detailId && confirm("Bu mijozni o'chirmoqchimisiz?")) {
                  deleteMutation.mutate(detailId);
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              O'chirish
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDetailId(null)}>
                Bekor qilish
              </Button>
              <Button size="sm" loading={updateMutation.isPending} onClick={handleSlideFormSave}>
                Saqlash
              </Button>
            </div>
          </div>
        }
      >
        {detail && (
          <div>
            <Tabs
              tabs={[
                { id: "info", label: "Ma'lumot" },
                { id: "debt", label: "Qarz" },
                { id: "sales", label: "Sotuvlar", count: detail.sales.length },
              ]}
              activeTab={detailTab}
              onChange={setDetailTab}
            />

            <div className="p-6">
              {detailTab === "info" && (
                <div className="space-y-4">
                  <Input
                    label="To'liq ism"
                    value={slideForm.fullName}
                    onChange={(e) => setSlideForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PhoneInput
                      label="Telefon"
                      value={slideForm.phone}
                      onChange={(v) => setSlideForm((f) => ({ ...f, phone: v }))}
                    />
                    <PhoneInput
                      label="Telefon 2"
                      value={slideForm.phone2}
                      onChange={(v) => setSlideForm((f) => ({ ...f, phone2: v }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Tug'ilgan sana"
                      type="date"
                      value={slideForm.birthday}
                      onChange={(e) => setSlideForm((f) => ({ ...f, birthday: e.target.value }))}
                    />
                    <Select
                      label="Kategoriya"
                      options={[
                        { value: "REGULAR", label: "Oddiy mijoz" },
                        { value: "MASTER", label: "Usta" },
                      ]}
                      value={slideForm.category}
                      onChange={(e) => setSlideForm((f) => ({ ...f, category: e.target.value as "REGULAR" | "MASTER" }))}
                    />
                  </div>
                  <Input
                    label="Manzil"
                    value={slideForm.address}
                    onChange={(e) => setSlideForm((f) => ({ ...f, address: e.target.value }))}
                  />
                  <Input
                    label="Izoh"
                    value={slideForm.notes}
                    onChange={(e) => setSlideForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              )}

              {detailTab === "debt" && debt && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Jami qarz (UZS)</p>
                      <p className="text-lg font-bold text-red-600">{formatUzs(debt.totalDebtUzs)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Jami qarz (USD)</p>
                      <p className="text-lg font-bold text-blue-600">{formatUsd(debt.totalDebtUsd)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Boshlang'ich qarz:</span>
                      <span>{formatUzs(debt.initialDebtUzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jami sotuvlar:</span>
                      <span>{formatUzs(debt.totalSalesUzs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jami to'langan:</span>
                      <span className="text-green-600">-{formatUzs(debt.totalPaidUzs)}</span>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "sales" && (
                <div className="space-y-2">
                  {detail.sales.length === 0 ? (
                    <EmptyState title="Sotuvlar yo'q" description="Bu mijoz hali xarid qilmagan" />
                  ) : (
                    detail.sales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{sale.documentNo}</p>
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
    </>
  );
}
