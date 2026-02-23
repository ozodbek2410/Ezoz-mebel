import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Modal, Input, CurrencyPairInput,
  Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading,
} from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { formatUzs, formatUsd } from "@ezoz/shared";
import toast from "react-hot-toast";

export function ServicesPage() {
  const { isBoss } = useAuth();
  const boss = isBoss();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", priceUzs: "0", priceUsd: "0", sortOrder: "0" });

  const servicesQuery = useQuery({
    queryKey: ["serviceType", "list"],
    queryFn: () => trpc.serviceType.list.query(),
  });

  const createService = useMutation({
    mutationFn: () =>
      trpc.serviceType.create.mutate({
        name: form.name,
        priceUzs: Number(form.priceUzs),
        priceUsd: Number(form.priceUsd),
        sortOrder: Number(form.sortOrder),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceType"] });
      closeModal();
      toast.success("Xizmat yaratildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateService = useMutation({
    mutationFn: () =>
      trpc.serviceType.update.mutate({
        id: editingId!,
        name: form.name,
        priceUzs: Number(form.priceUzs),
        priceUsd: Number(form.priceUsd),
        sortOrder: Number(form.sortOrder),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceType"] });
      closeModal();
      toast.success("Xizmat yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteService = useMutation({
    mutationFn: (id: number) => trpc.serviceType.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceType"] });
      toast.success("Xizmat o'chirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", priceUzs: "0", priceUsd: "0", sortOrder: "0" });
    setModalOpen(true);
  }

  function openEdit(service: { id: number; name: string; priceUzs: unknown; priceUsd: unknown; sortOrder: number }) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      priceUzs: String(service.priceUzs),
      priceUsd: String(service.priceUsd),
      sortOrder: String(service.sortOrder),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Xizmat nomini kiriting");
      return;
    }
    if (editingId) {
      updateService.mutate();
    } else {
      createService.mutate();
    }
  }

  const services = servicesQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Xizmatlar"
        actions={
          boss ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Yangi xizmat
            </Button>
          ) : undefined
        }
      />

      <div className="page-body">
        <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <th className="w-12">#</th>
              <th>Nomi</th>
              <th>Narx (UZS)</th>
              <th className="hidden sm:table-cell">Narx (USD)</th>
              <th className="w-16 hidden sm:table-cell">Tartib</th>
              {boss && <th className="w-28">Amallar</th>}
            </tr>
          </TableHead>
          <TableBody>
            {servicesQuery.isLoading ? (
              <TableLoading colSpan={boss ? 6 : 5} />
            ) : services.length === 0 ? (
              <TableEmpty colSpan={boss ? 6 : 5} message="Xizmatlar yo'q" />
            ) : (
              services.map((service, idx) => (
                <TableRow key={service.id}>
                  <td className="text-gray-400 text-sm">{idx + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">{service.name}</span>
                    </div>
                  </td>
                  <td className="currency-uzs">{formatUzs(Number(service.priceUzs))}</td>
                  <td className="currency-usd hidden sm:table-cell">{formatUsd(Number(service.priceUsd))}</td>
                  <td className="text-gray-400 text-sm hidden sm:table-cell">{service.sortOrder}</td>
                  {boss && (
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                          onClick={() => openEdit(service)}
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-red-50 rounded-lg"
                          onClick={() => {
                            if (confirm("Bu xizmatni o'chirmoqchimisiz?")) {
                              deleteService.mutate(service.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Xizmatni tahrirlash" : "Yangi xizmat"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Bekor qilish</Button>
            <Button
              loading={createService.isPending || updateService.isPending}
              onClick={handleSave}
            >
              Saqlash
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Xizmat nomi"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Masalan: Kesish"
          />
          <CurrencyPairInput
            label="Narx"
            valueUzs={form.priceUzs}
            valueUsd={form.priceUsd}
            onChangeUzs={(v) => setForm((f) => ({ ...f, priceUzs: v }))}
            onChangeUsd={(v) => setForm((f) => ({ ...f, priceUsd: v }))}
          />
          <Input
            label="Tartib raqami"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}
