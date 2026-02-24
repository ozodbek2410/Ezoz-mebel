import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Building2, StickyNote } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Input, Tabs } from "@/components/ui";
import { useT, getT } from "@/hooks/useT";
import toast from "react-hot-toast";

export function AdminSettingsPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState("company");

  return (
    <>
      <PageHeader title={t("Sozlamalar")} />

      <div className="page-body">
        <Tabs
          tabs={[
            { id: "company", label: t("Kompaniya") },
            { id: "notes", label: t("Eslatmalar") },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-6">
          {activeTab === "company" && <CompanyInfoTab />}
          {activeTab === "notes" && <NotesTab />}
        </div>
      </div>
    </>
  );
}

// ===== Company Info =====
function CompanyInfoTab() {
  const t = useT();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    workHours: "",
  });

  const infoQuery = useQuery({
    queryKey: ["settings", "companyInfo"],
    queryFn: () => trpc.settings.getCompanyInfo.query(),
  });

  useEffect(() => {
    if (infoQuery.data) {
      setForm({
        name: infoQuery.data["name"] || "",
        address: infoQuery.data["address"] || "",
        phone: infoQuery.data["phone"] || "",
        workHours: infoQuery.data["workHours"] || "",
      });
    }
  }, [infoQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(form)) {
        await trpc.settings.setCompanyInfo.mutate({ key, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(getT()("Saqlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="card card-body max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-brand-600" />
        <h3 className="text-base font-semibold">{t("Kompaniya ma'lumotlari")}</h3>
      </div>
      <div className="space-y-4">
        <Input label={t("Kompaniya nomi")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="EZOZ MEBEL" />
        <Input label={t("Manzil")} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <Input label={t("Telefon")} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <Input label={t("Ish vaqti")} value={form.workHours} onChange={(e) => setForm((f) => ({ ...f, workHours: e.target.value }))} placeholder="09:00 - 18:00" />
        <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="w-4 h-4" />
          {t("Saqlash")}
        </Button>
      </div>
    </div>
  );
}

// ===== Notes =====
function NotesTab() {
  const t = useT();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const notesQuery = useQuery({
    queryKey: ["settings", "notes"],
    queryFn: () => trpc.settings.getNotes.query(),
  });

  useEffect(() => {
    if (notesQuery.data) {
      setContent(notesQuery.data.content);
    }
  }, [notesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => trpc.settings.saveNote.mutate({ content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "notes"] });
      toast.success(getT()("Saqlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (content && content !== notesQuery.data?.content) {
        saveMutation.mutate();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [content, notesQuery.data?.content]);

  return (
    <div className="card card-body max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-semibold">{t("Eslatmalar")}</h3>
        </div>
        <span className="text-xs text-gray-400">{content.length}/800</span>
      </div>
      <textarea
        className="input-field min-h-[200px] resize-y"
        value={content}
        onChange={(e) => {
          if (e.target.value.length <= 800) setContent(e.target.value);
        }}
        placeholder={t("Bu yerga eslatmalar yozing...")}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">{t("Avtomatik saqlanadi (60s)")}</span>
        <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="w-3.5 h-3.5" />
          {t("Saqlash")}
        </Button>
      </div>
    </div>
  );
}
