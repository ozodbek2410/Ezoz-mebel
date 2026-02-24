import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Modal, Input, Select, CurrencyPairInput, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading, Badge } from "@/components/ui";
import { CurrencyDisplay } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { formatUzs } from "@ezoz/shared";
import toast from "react-hot-toast";
import { useT, getT } from "@/hooks/useT";

export function ExpensesPage() {
  const t = useT();
  const { isBoss, user } = useAuth();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [form, setForm] = useState({
    categoryId: "",
    amountUzs: "0",
    amountUsd: "0",
    description: "",
    cashRegister: "SALES" as "SALES" | "SERVICE",
    paymentType: "CASH_UZS" as string,
  });
  const [catName, setCatName] = useState("");

  // Queries
  const categoriesQuery = useQuery({
    queryKey: ["expense", "categories"],
    queryFn: () => trpc.expense.categories.query(),
  });

  const expensesQuery = useQuery({
    queryKey: ["expense", "list"],
    queryFn: () => trpc.expense.list.query({}),
  });

  // Mutations
  const createExpense = useMutation({
    mutationFn: () =>
      trpc.expense.create.mutate({
        categoryId: Number(form.categoryId),
        amountUzs: Number(form.amountUzs),
        amountUsd: Number(form.amountUsd),
        description: form.description,
        cashRegister: form.cashRegister,
        paymentType: form.paymentType as "CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense"] });
      setModalOpen(false);
      setForm({ categoryId: "", amountUzs: "0", amountUsd: "0", description: "", cashRegister: "SALES", paymentType: "CASH_UZS" });
      toast.success(getT()("Xarajat qo'shildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const createCategory = useMutation({
    mutationFn: () => trpc.expense.createCategory.mutate({ name: catName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense", "categories"] });
      setCatModalOpen(false);
      setCatName("");
      toast.success(getT()("Kategoriya qo'shildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const catOptions = (categoriesQuery.data ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const expenses = expensesQuery.data ?? [];
  const totalUzs = expenses.reduce((sum, e) => sum + Number(e.amountUzs), 0);

  return (
    <>
      <PageHeader
        title={t("Xarajatlar")}
        subtitle={`${t("Jami")}: ${formatUzs(totalUzs)}`}
        actions={
          <div className="flex items-center gap-2">
            {isBoss() && (
              <Button variant="secondary" size="sm" onClick={() => setCatModalOpen(true)}>
                <Plus className="w-4 h-4" />
                {t("Kategoriya")}
              </Button>
            )}
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" />
              {t("Xarajat")}
            </Button>
          </div>
        }
      />

      <div className="page-body">
        <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <th className="hidden sm:table-cell">{t("Sana")}</th>
              <th>{t("Kategoriya")}</th>
              <th>{t("Tavsif")}</th>
              <th className="hidden md:table-cell">{t("Kassa")}</th>
              <th className="hidden sm:table-cell">{t("To'lov turi")}</th>
              <th>{t("Summa")}</th>
            </tr>
          </TableHead>
          <TableBody>
            {expensesQuery.isLoading ? (
              <TableLoading colSpan={6} />
            ) : expenses.length === 0 ? (
              <TableEmpty colSpan={6} message={t("Xarajatlar yo'q")} />
            ) : (
              expenses.map((exp) => (
                <TableRow key={exp.id}>
                  <td className="text-sm text-gray-500 hidden sm:table-cell">
                    {new Date(exp.createdAt).toLocaleDateString("uz")}
                  </td>
                  <td>
                    <Badge variant="neutral">{exp.category.name}</Badge>
                  </td>
                  <td className="text-gray-700">{exp.description}</td>
                  <td className="hidden md:table-cell">
                    <Badge variant={exp.cashRegister === "SALES" ? "info" : "warning"}>
                      {exp.cashRegister === "SALES" ? t("Savdo") : t("Xizmat")}
                    </Badge>
                  </td>
                  <td className="text-sm text-gray-500 hidden sm:table-cell">{exp.paymentType}</td>
                  <td>
                    <CurrencyDisplay amountUzs={exp.amountUzs} amountUsd={exp.amountUsd} />
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* New expense modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("Yangi xarajat")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("Bekor qilish")}</Button>
            <Button
              loading={createExpense.isPending}
              onClick={() => {
                if (!form.categoryId || !form.description) {
                  toast.error(getT()("Kategoriya va tavsifni kiriting"));
                  return;
                }
                createExpense.mutate();
              }}
            >
              {t("Qo'shish")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t("Kategoriya")}
            options={catOptions}
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            placeholder={t("Tanlang...")}
          />
          <Input
            label={t("Tavsif")}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t("Xarajat haqida")}
          />
          <CurrencyPairInput
            label={t("Summa")}
            valueUzs={form.amountUzs}
            valueUsd={form.amountUsd}
            onChangeUzs={(v) => setForm((f) => ({ ...f, amountUzs: v }))}
            onChangeUsd={(v) => setForm((f) => ({ ...f, amountUsd: v }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={t("Kassa")}
              options={[
                { value: "SALES", label: t("Savdo kassasi") },
                { value: "SERVICE", label: t("Xizmat kassasi") },
              ]}
              value={form.cashRegister}
              onChange={(e) => setForm((f) => ({ ...f, cashRegister: e.target.value as "SALES" | "SERVICE" }))}
            />
            <Select
              label={t("To'lov turi")}
              options={[
                { value: "CASH_UZS", label: t("Naqd (UZS)") },
                { value: "CASH_USD", label: t("Naqd (USD)") },
                { value: "CARD", label: t("Karta") },
                { value: "TRANSFER", label: t("O'tkazma") },
              ]}
              value={form.paymentType}
              onChange={(e) => setForm((f) => ({ ...f, paymentType: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Category modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={t("Yangi xarajat kategoriyasi")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>{t("Bekor qilish")}</Button>
            <Button loading={createCategory.isPending} onClick={() => {
              if (!catName) { toast.error(getT()("Nom kiriting")); return; }
              createCategory.mutate();
            }}>
              {t("Qo'shish")}
            </Button>
          </>
        }
      >
        <Input label={t("Kategoriya nomi")} value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t("Masalan: Transport")} />
      </Modal>
    </>
  );
}
