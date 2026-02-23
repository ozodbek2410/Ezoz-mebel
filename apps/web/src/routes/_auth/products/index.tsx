import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Lock, Package, ChevronRight, ChevronDown, FolderOpen, ImagePlus, X, Printer, QrCode, ArrowUp, ArrowDown, ArrowUpDown, Warehouse, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, SearchInput, Modal, Input, CurrencyPairInput, Select, Badge, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading, SlideOver } from "@/components/ui";
import { CurrencyDisplay } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { uploadProductImage } from "@/lib/upload";
import QRCode from "qrcode";
import toast from "react-hot-toast";

// ===== Category Tree Component =====
interface CategoryNode {
  id: number;
  name: string;
  sortOrder: number;
  parentId: number | null;
  children: CategoryNode[];
  _count: { products: number };
}

function CategoryTree({
  categories,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  isBoss,
}: {
  categories: CategoryNode[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onEdit: (cat: CategoryNode) => void;
  onDelete: (id: number) => void;
  isBoss: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: CategoryNode, depth = 0) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`tree-item group ${isSelected ? "active" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => onSelect(isSelected ? null : node.id)}
        >
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-gray-200 rounded"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4.5" />
          )}
          <FolderOpen className="w-4 h-4 text-brand-500 shrink-0" />
          <span className="flex-1 truncate">{node.name}</span>
          <span className="text-xs text-gray-400">{node._count.products}</span>
          {isBoss && (
            <div className="hidden group-hover:flex items-center gap-1">
              <button
                className="p-1 hover:bg-gray-200 rounded"
                onClick={(e) => { e.stopPropagation(); onEdit(node); }}
              >
                <Edit2 className="w-3 h-3 text-gray-500" />
              </button>
              <button
                className="p-1 hover:bg-red-100 rounded"
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map((child) => renderNode(child as CategoryNode, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`tree-item ${selectedId === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <Package className="w-4 h-4 text-gray-500" />
        <span className="flex-1">Barcha mahsulotlar</span>
      </div>
      {categories.map((cat) => renderNode(cat))}
    </div>
  );
}

// ===== Product Form Modal =====
interface ProductFormData {
  name: string;
  categoryId: string;
  unit: string;
  sellPriceUzs: string;
  sellPriceUsd: string;
  minPriceUzs: string;
  minPriceUsd: string;
  costPriceUzs: string;
  costPriceUsd: string;
  sku: string;
  description: string;
}

const defaultForm: ProductFormData = {
  name: "",
  categoryId: "",
  unit: "DONA",
  sellPriceUzs: "0",
  sellPriceUsd: "0",
  minPriceUzs: "0",
  minPriceUsd: "0",
  costPriceUzs: "0",
  costPriceUsd: "0",
  sku: "",
  description: "",
};

const unitOptions = [
  { value: "DONA", label: "Dona" },
  { value: "M2", label: "m2" },
  { value: "METR", label: "Metr" },
  { value: "LIST", label: "List" },
  { value: "KG", label: "Kg" },
];

// ===== Main Page =====
export function ProductsPage() {
  const { isBoss } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [form, setForm] = useState<ProductFormData>(defaultForm);
  const [slideForm, setSlideForm] = useState<ProductFormData>(defaultForm);
  const [catForm, setCatForm] = useState({ name: "", parentId: "" });
  const [sortKey, setSortKey] = useState<"name" | "code" | "category" | "sellPrice" | "minPrice" | "costPrice" | "stock">("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showCategories, setShowCategories] = useState(false);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Queries
  const categoriesQuery = useQuery({
    queryKey: ["category", "tree"],
    queryFn: () => trpc.category.getTree.query(),
  });

  const productsQuery = useQuery({
    queryKey: ["product", "list", selectedCategory, search],
    queryFn: () =>
      trpc.product.list.query({
        categoryId: selectedCategory ?? undefined,
        search: search || undefined,
      }),
  });

  const productDetailQuery = useQuery({
    queryKey: ["product", "detail", selectedProductId],
    queryFn: () => trpc.product.getById.query({ id: selectedProductId! }),
    enabled: selectedProductId !== null,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  // Mutations
  const createProduct = useMutation({
    mutationFn: (data: typeof form) =>
      trpc.product.create.mutate({
        name: data.name,
        categoryId: Number(data.categoryId),
        unit: data.unit as "DONA" | "M2" | "METR" | "LIST" | "KG",
        sellPriceUzs: Number(data.sellPriceUzs),
        sellPriceUsd: Number(data.sellPriceUsd),
        minPriceUzs: Number(data.minPriceUzs),
        minPriceUsd: Number(data.minPriceUsd),
        costPriceUzs: Number(data.costPriceUzs),
        costPriceUsd: Number(data.costPriceUsd),
        sku: data.sku || undefined,
        description: data.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["category"] });
      setProductModalOpen(false);
      setForm(defaultForm);
      toast.success("Mahsulot qo'shildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProduct = useMutation({
    mutationFn: (data: ProductFormData & { id: number }) =>
      trpc.product.update.mutate({
        id: data.id,
        name: data.name,
        categoryId: Number(data.categoryId),
        unit: data.unit as "DONA" | "M2" | "METR" | "LIST" | "KG",
        sellPriceUzs: Number(data.sellPriceUzs),
        sellPriceUsd: Number(data.sellPriceUsd),
        minPriceUzs: Number(data.minPriceUzs),
        minPriceUsd: Number(data.minPriceUsd),
        costPriceUzs: Number(data.costPriceUzs),
        costPriceUsd: Number(data.costPriceUsd),
        sku: data.sku || undefined,
        description: data.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      setSelectedProductId(null);
      toast.success("Mahsulot yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => trpc.product.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["category"] });
      toast.success("Mahsulot o'chirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const addImage = useMutation({
    mutationFn: async (file: File) => {
      const filePath = await uploadProductImage(file);
      return trpc.product.addImage.mutate({ productId: selectedProductId!, filePath });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", "detail", selectedProductId] });
      toast.success("Rasm qo'shildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeImage = useMutation({
    mutationFn: (id: number) => trpc.product.removeImage.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", "detail", selectedProductId] });
      toast.success("Rasm o'chirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStock = useMutation({
    mutationFn: (data: { productId: number; warehouseId: number; quantity: number }) =>
      trpc.warehouse.updateStock.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success("Qoldiq yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const createCategory = useMutation({
    mutationFn: (data: { name: string; parentId?: number }) =>
      trpc.category.create.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category"] });
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCatForm({ name: "", parentId: "" });
      toast.success("Guruh qo'shildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCategory = useMutation({
    mutationFn: (data: { id: number; name: string }) =>
      trpc.category.update.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category"] });
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCatForm({ name: "", parentId: "" });
      toast.success("Guruh yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: number) => trpc.category.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category"] });
      toast.success("Guruh o'chirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  // Handlers
  function handleProductSubmit() {
    if (!form.name || !form.categoryId) {
      toast.error("Nom va guruhni tanlang");
      return;
    }
    createProduct.mutate(form);
  }

  function handleSlideFormSave() {
    if (!slideForm.name || !slideForm.categoryId) {
      toast.error("Nom va guruhni tanlang");
      return;
    }
    if (selectedProductId) {
      updateProduct.mutate({ ...slideForm, id: selectedProductId });
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) addImage.mutate(file);
    }
    e.target.value = "";
  }

  async function handlePrintLabel(product?: { id: number; code: string; name: string; sellPriceUzs: unknown; sellPriceUsd: unknown }) {
    const detail = product ?? productDetailQuery.data;
    if (!detail) return;

    const qrData = JSON.stringify({ id: detail.id, code: detail.code, name: detail.name });
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 150, margin: 1 });

    const priceUzs = Number(detail.sellPriceUzs).toLocaleString("uz-UZ");
    const priceUsd = Number(detail.sellPriceUsd).toFixed(2);

    const printWindow = window.open("", "_blank", "width=400,height=400");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Yorliq - ${detail.name}</title>
  <style>
    @page { size: 58mm 40mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 58mm; font-family: Arial, sans-serif; padding: 2mm; }
    .name { font-size: 9pt; font-weight: bold; text-align: center; margin-bottom: 1mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qr { text-align: center; margin-bottom: 1mm; }
    .qr img { width: 20mm; height: 20mm; }
    .price { text-align: center; font-size: 10pt; font-weight: bold; }
    .price-uzs { color: #dc2626; }
    .price-usd { color: #2563eb; font-size: 8pt; }
    .code { text-align: center; font-size: 7pt; color: #666; margin-top: 1mm; }
  </style>
</head>
<body>
  <div class="name">${detail.name}</div>
  <div class="qr"><img src="${qrDataUrl}" /></div>
  <div class="price">
    <div class="price-uzs">${priceUzs} so'm</div>
    <div class="price-usd">$${priceUsd}</div>
  </div>
  <div class="code">${detail.code}</div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  function handleCategorySubmit() {
    if (!catForm.name) {
      toast.error("Guruh nomini kiriting");
      return;
    }
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, name: catForm.name });
    } else {
      createCategory.mutate({
        name: catForm.name,
        parentId: catForm.parentId ? Number(catForm.parentId) : undefined,
      });
    }
  }

  // Flatten categories for select options
  function flattenCategories(cats: CategoryNode[], depth = 0): { value: string; label: string }[] {
    const result: { value: string; label: string }[] = [];
    for (const cat of cats) {
      result.push({ value: String(cat.id), label: `${"  ".repeat(depth)}${cat.name}` });
      if (cat.children.length > 0) {
        result.push(...flattenCategories(cat.children as CategoryNode[], depth + 1));
      }
    }
    return result;
  }

  const categoryOptions = categoriesQuery.data ? flattenCategories(categoriesQuery.data as CategoryNode[]) : [];
  const rawProducts = productsQuery.data ?? [];

  type ProductItem = typeof rawProducts[number];

  function getStockTotal(product: ProductItem): number {
    return product.stockItems.reduce((sum, si) => sum + Number(si.quantity), 0);
  }

  const products = [...rawProducts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name": return a.name.localeCompare(b.name) * dir;
      case "code": return a.code.localeCompare(b.code) * dir;
      case "category": return a.category.name.localeCompare(b.category.name) * dir;
      case "sellPrice": return (Number(a.sellPriceUzs) - Number(b.sellPriceUzs)) * dir;
      case "minPrice": return (Number(a.minPriceUzs) - Number(b.minPriceUzs)) * dir;
      case "costPrice": return (Number(a.costPriceUzs) - Number(b.costPriceUzs)) * dir;
      case "stock": return (getStockTotal(a) - getStockTotal(b)) * dir;
      default: return 0;
    }
  });

  // Sync slideForm with product detail data
  useEffect(() => {
    const detail = productDetailQuery.data;
    if (detail) {
      setSlideForm({
        name: detail.name,
        categoryId: String(detail.categoryId),
        unit: detail.unit,
        sellPriceUzs: String(detail.sellPriceUzs),
        sellPriceUsd: String(detail.sellPriceUsd),
        minPriceUzs: String(detail.minPriceUzs),
        minPriceUsd: String(detail.minPriceUsd),
        costPriceUzs: String(detail.costPriceUzs),
        costPriceUsd: String(detail.costPriceUsd),
        sku: detail.sku || "",
        description: detail.description || "",
      });
    }
  }, [productDetailQuery.data]);

  return (
    <>
      <PageHeader
        title="Mahsulotlar"
        subtitle={`${products.length} ta mahsulot`}
        actions={
          isBoss() && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingCategory(null);
                  setCatForm({ name: "", parentId: "" });
                  setCategoryModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Guruh
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setForm({ ...defaultForm, categoryId: selectedCategory ? String(selectedCategory) : "" });
                  setProductModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Mahsulot
              </Button>
            </div>
          )
        }
      />

      <div className="page-body">
        <div className="flex gap-6">
          {/* Category tree sidebar — hidden on mobile, shown on lg+ */}
          <div className="hidden lg:block w-64 shrink-0">
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-gray-700">Guruhlar</h3>
              </div>
              <div className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                {categoriesQuery.isLoading ? (
                  <div className="p-4 text-center text-gray-400 text-sm">Yuklanmoqda...</div>
                ) : (
                  <CategoryTree
                    categories={(categoriesQuery.data ?? []) as CategoryNode[]}
                    selectedId={selectedCategory}
                    onSelect={setSelectedCategory}
                    onEdit={(cat) => {
                      setEditingCategory(cat);
                      setCatForm({ name: cat.name, parentId: "" });
                      setCategoryModalOpen(true);
                    }}
                    onDelete={(id) => {
                      if (confirm("Bu guruhni o'chirmoqchimisiz?")) {
                        deleteCategory.mutate(id);
                      }
                    }}
                    isBoss={isBoss()}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mobile category panel */}
          {showCategories && (
            <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setShowCategories(false)}>
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Guruhlar</h3>
                  <button onClick={() => setShowCategories(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-2">
                  <CategoryTree
                    categories={(categoriesQuery.data ?? []) as CategoryNode[]}
                    selectedId={selectedCategory}
                    onSelect={(id) => { setSelectedCategory(id); setShowCategories(false); }}
                    onEdit={(cat) => {
                      setEditingCategory(cat);
                      setCatForm({ name: cat.name, parentId: "" });
                      setCategoryModalOpen(true);
                      setShowCategories(false);
                    }}
                    onDelete={(id) => {
                      if (confirm("Bu guruhni o'chirmoqchimisiz?")) {
                        deleteCategory.mutate(id);
                      }
                    }}
                    isBoss={isBoss()}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Products table */}
          <div className="flex-1 min-w-0">
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setShowCategories(true)}
                className="lg:hidden shrink-0 p-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <SearchInput
                  placeholder="Mahsulot qidirish (nom, kod, SKU)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <tr>
                  <th className="w-12 hidden sm:table-cell"></th>
                  <th className="whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => toggleSort("code")}>
                      Mahsulot
                      {sortKey === "code" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="w-28 whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => toggleSort("category")}>
                      <FolderOpen className="w-3.5 h-3.5" />
                      Guruh
                      {sortKey === "category" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="w-32 whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => toggleSort("sellPrice")}>
                      Sotish
                      {sortKey === "sellPrice" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="w-32 whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => toggleSort("minPrice")}>
                      Min
                      {sortKey === "minPrice" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="w-32 whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => toggleSort("costPrice")}>
                      Tan
                      {sortKey === "costPrice" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="w-20 whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => toggleSort("stock")}>
                      Qoldiq
                      {sortKey === "stock" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="w-10"></th>
                </tr>
              </TableHead>
              <TableBody>
                {productsQuery.isLoading ? (
                  <TableLoading colSpan={8} />
                ) : products.length === 0 ? (
                  <TableEmpty colSpan={8} message="Mahsulot topilmadi" />
                ) : (
                  products.map((product) => {
                    const stock = getStockTotal(product);
                    const minAlert = Number(product.minStockAlert);
                    const stockClass = stock <= 0 ? "stock-empty" : stock <= minAlert ? "stock-low" : "stock-ok";
                    const thumbnail = product.images[0]?.filePath;

                    return (
                      <TableRow
                        key={product.id}
                        active={selectedProductId === product.id}
                        onClick={() => setSelectedProductId(selectedProductId === product.id ? null : product.id)}
                      >
                        <td className="!p-1.5 hidden sm:table-cell">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                            {thumbnail ? (
                              <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-gray-900 whitespace-nowrap">{product.name}</span>
                            {product.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <span className="font-mono">{product.code}</span>
                            <span>{unitOptions.find((u) => u.value === product.unit)?.label ?? product.unit}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant="neutral">{product.category.name}</Badge>
                        </td>
                        <td>
                          <CurrencyDisplay amountUzs={product.sellPriceUzs} amountUsd={product.sellPriceUsd} />
                        </td>
                        <td>
                          <CurrencyDisplay amountUzs={product.minPriceUzs} amountUsd={product.minPriceUsd} />
                        </td>
                        <td>
                          <CurrencyDisplay amountUzs={product.costPriceUzs} amountUsd={product.costPriceUsd} />
                        </td>
                        <td>
                          <span className={stockClass}>{stock}</span>
                        </td>
                        <td className="!p-1">
                          <div className="flex items-center gap-0.5">
                            <button
                              className="p-2 sm:p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="QR yorliq chop etish"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintLabel(product);
                              }}
                            >
                              <QrCode className="w-5 h-5 sm:w-4 sm:h-4 text-gray-400" />
                            </button>
                            {isBoss() && (
                              <>
                                <button
                                  className="p-2 sm:p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Tahrirlash"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProductId(product.id);
                                  }}
                                >
                                  <Edit2 className="w-5 h-5 sm:w-4 sm:h-4 text-gray-400" />
                                </button>
                                <button
                                  className="p-2 sm:p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                  title="O'chirish"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`"${product.name}" mahsulotini o'chirmoqchimisiz?`)) {
                                      deleteProduct.mutate(product.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-5 h-5 sm:w-4 sm:h-4 text-gray-400" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Product Modal (yangi mahsulot) */}
      <Modal
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false);
          setForm(defaultForm);
        }}
        title="Yangi mahsulot"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProductModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              loading={createProduct.isPending}
              onClick={handleProductSubmit}
            >
              Qo'shish
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Mahsulot nomi"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="MDF list 18mm Shimo svetliy"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Guruh"
              options={categoryOptions}
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              placeholder="Tanlang..."
            />
            <Select
              label="O'lchov birligi"
              options={unitOptions}
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </div>
          <Input
            label="SKU (ixtiyoriy)"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          />

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Narxlar</h4>
            <CurrencyPairInput
              label="Sotish narxi"
              valueUzs={form.sellPriceUzs}
              valueUsd={form.sellPriceUsd}
              onChangeUzs={(v) => setForm((f) => ({ ...f, sellPriceUzs: v }))}
              onChangeUsd={(v) => setForm((f) => ({ ...f, sellPriceUsd: v }))}
            />
            <CurrencyPairInput
              label="Minimal narx"
              valueUzs={form.minPriceUzs}
              valueUsd={form.minPriceUsd}
              onChangeUzs={(v) => setForm((f) => ({ ...f, minPriceUzs: v }))}
              onChangeUsd={(v) => setForm((f) => ({ ...f, minPriceUsd: v }))}
            />
            <CurrencyPairInput
              label="Tan narxi"
              valueUzs={form.costPriceUzs}
              valueUsd={form.costPriceUsd}
              onChangeUzs={(v) => setForm((f) => ({ ...f, costPriceUzs: v }))}
              onChangeUsd={(v) => setForm((f) => ({ ...f, costPriceUsd: v }))}
            />
          </div>

          <Input
            label="Tavsif (ixtiyoriy)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
          setCatForm({ name: "", parentId: "" });
        }}
        title={editingCategory ? "Guruhni tahrirlash" : "Yangi guruh"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              loading={createCategory.isPending || updateCategory.isPending}
              onClick={handleCategorySubmit}
            >
              {editingCategory ? "Saqlash" : "Qo'shish"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Guruh nomi"
            value={catForm.name}
            onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Masalan: MDF LAR"
          />
          {!editingCategory && (
            <Select
              label="Ota guruh (ixtiyoriy)"
              options={[{ value: "", label: "Asosiy guruh" }, ...categoryOptions]}
              value={catForm.parentId}
              onChange={(e) => setCatForm((f) => ({ ...f, parentId: e.target.value }))}
            />
          )}
        </div>
      </Modal>

      {/* Product Detail SlideOver */}
      <SlideOver
        open={selectedProductId !== null && !!productDetailQuery.data}
        onClose={() => setSelectedProductId(null)}
        title={productDetailQuery.data?.name ?? ""}
        subtitle={productDetailQuery.data ? `${productDetailQuery.data.code} | ${unitOptions.find((u) => u.value === productDetailQuery.data?.unit)?.label ?? productDetailQuery.data.unit}` : ""}
        headerLeft={
          <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-brand-600" />
          </div>
        }
        footer={
          isBoss() ? (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (selectedProductId && confirm("Bu mahsulotni o'chirmoqchimisiz?")) {
                    deleteProduct.mutate(selectedProductId);
                    setSelectedProductId(null);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                O'chirish
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handlePrintLabel()}>
                  <Printer className="w-3.5 h-3.5" />
                  Yorliq
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedProductId(null)}>
                  Bekor qilish
                </Button>
                <Button size="sm" loading={updateProduct.isPending} onClick={handleSlideFormSave}>
                  Saqlash
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {productDetailQuery.data && (
          <div className="p-6 space-y-4">
            <Input
              label="Mahsulot nomi"
              value={slideForm.name}
              onChange={(e) => setSlideForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!isBoss()}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Guruh"
                options={categoryOptions}
                value={slideForm.categoryId}
                onChange={(e) => setSlideForm((f) => ({ ...f, categoryId: e.target.value }))}
                disabled={!isBoss()}
              />
              <Select
                label="O'lchov birligi"
                options={unitOptions}
                value={slideForm.unit}
                onChange={(e) => setSlideForm((f) => ({ ...f, unit: e.target.value }))}
                disabled={!isBoss()}
              />
            </div>
            <Input
              label="SKU"
              value={slideForm.sku}
              onChange={(e) => setSlideForm((f) => ({ ...f, sku: e.target.value }))}
              disabled={!isBoss()}
            />

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Narxlar</h4>
              <CurrencyPairInput
                label="Sotish narxi"
                valueUzs={slideForm.sellPriceUzs}
                valueUsd={slideForm.sellPriceUsd}
                onChangeUzs={(v) => setSlideForm((f) => ({ ...f, sellPriceUzs: v }))}
                onChangeUsd={(v) => setSlideForm((f) => ({ ...f, sellPriceUsd: v }))}
              />
              <CurrencyPairInput
                label="Minimal narx"
                valueUzs={slideForm.minPriceUzs}
                valueUsd={slideForm.minPriceUsd}
                onChangeUzs={(v) => setSlideForm((f) => ({ ...f, minPriceUzs: v }))}
                onChangeUsd={(v) => setSlideForm((f) => ({ ...f, minPriceUsd: v }))}
              />
              <CurrencyPairInput
                label="Tan narxi"
                valueUzs={slideForm.costPriceUzs}
                valueUsd={slideForm.costPriceUsd}
                onChangeUzs={(v) => setSlideForm((f) => ({ ...f, costPriceUzs: v }))}
                onChangeUsd={(v) => setSlideForm((f) => ({ ...f, costPriceUsd: v }))}
              />
            </div>

            <Input
              label="Tavsif"
              value={slideForm.description}
              onChange={(e) => setSlideForm((f) => ({ ...f, description: e.target.value }))}
              disabled={!isBoss()}
            />

            {/* Product images */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Rasmlar</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {productDetailQuery.data.images.map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-100">
                    <img
                      src={img.filePath}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {isBoss() && (
                      <button
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage.mutate(img.id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {isBoss() && (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                    <ImagePlus className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-1">Qo'shish</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Stock edit */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Ombor qoldiqlari</h4>
              <div className="space-y-1.5">
                {productDetailQuery.data.stockItems.map((si) => (
                  <div key={si.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                    <Warehouse className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-600 flex-1">{si.warehouse.name}</span>
                    {isBoss() ? (
                      <input
                        type="number"
                        className="input-field w-20 text-sm py-1 text-right"
                        defaultValue={Number(si.quantity)}
                        onBlur={(e) => {
                          const newQty = Number(e.target.value);
                          if (newQty !== Number(si.quantity)) {
                            updateStock.mutate({
                              productId: selectedProductId!,
                              warehouseId: si.warehouseId,
                              quantity: newQty,
                            });
                          }
                        }}
                      />
                    ) : (
                      <span className="font-medium">{Number(si.quantity)}</span>
                    )}
                  </div>
                ))}
                {isBoss() && (warehousesQuery.data ?? []).filter(
                  (w) => !productDetailQuery.data!.stockItems.some((si) => si.warehouseId === w.id)
                ).length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <select
                      className="input-field text-sm py-1.5 flex-1"
                      id="newStockWarehouse"
                      defaultValue=""
                    >
                      <option value="" disabled>Ombor qo'shish...</option>
                      {(warehousesQuery.data ?? [])
                        .filter((w) => !productDetailQuery.data!.stockItems.some((si) => si.warehouseId === w.id))
                        .map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <input
                      type="number"
                      className="input-field w-20 text-sm py-1.5 text-right"
                      id="newStockQty"
                      placeholder="0"
                      defaultValue=""
                    />
                    <button
                      className="p-1.5 hover:bg-brand-50 rounded text-brand-600"
                      onClick={() => {
                        const wSelect = document.getElementById("newStockWarehouse") as HTMLSelectElement;
                        const qtyInput = document.getElementById("newStockQty") as HTMLInputElement;
                        const wId = Number(wSelect.value);
                        const qty = Number(qtyInput.value);
                        if (!wId) { toast.error("Ombor tanlang"); return; }
                        updateStock.mutate({
                          productId: selectedProductId!,
                          warehouseId: wId,
                          quantity: qty || 0,
                        });
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </>
  );
}
