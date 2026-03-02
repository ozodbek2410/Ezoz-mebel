import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePWA } from "@/hooks/usePWA";
import { useUIStore } from "@/store/ui.store";
import { UserRoleLabels, type Permission } from "@ezoz/shared";
import type { UserRole } from "@ezoz/shared";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth.store";
import toast from "react-hot-toast";
import { useT, getT } from "@/hooks/useT";
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Wrench,
  Receipt,
  CreditCard,
  BarChart3,
  UserCog,
  Settings,
  Store,
  Factory,
  Settings2,
  Scissors,
  Download,
  ChevronDown,
  X,
  Save,
  Lock,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: Permission;
}

interface NavSection {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Asosiy",
    icon: LayoutDashboard,
    items: [
      { label: "Bosh sahifa", href: "/dashboard", icon: LayoutDashboard },
      { label: "Mijozlar", href: "/customers", icon: Users, permission: "customer:read" },
    ],
  },
  {
    title: "Savdo",
    icon: ShoppingCart,
    items: [
      { label: "Mahsulotlar", href: "/products", icon: Package, permission: "product:read" },
      { label: "Xizmatlar", href: "/services", icon: Wrench, permission: "sale:service" },
      { label: "Savdo kassasi", href: "/sales", icon: ShoppingCart, permission: "sale:product" },
      { label: "Xizmat kassasi", href: "/sales/service", icon: Settings2, permission: "sale:service" },
      { label: "Ustaxona", href: "/workshop", icon: Factory, permission: "workshop:view" },
      { label: "Ombor", href: "/warehouse", icon: Warehouse, permission: "warehouse:read" },
    ],
  },
  {
    title: "Moliya",
    icon: CreditCard,
    items: [
      { label: "Cheklar", href: "/receipts", icon: Receipt, permission: "receipt:print" },
      { label: "Xarajatlar", href: "/expenses", icon: CreditCard, permission: "expense:create" },
      { label: "Hisobotlar", href: "/reports", icon: BarChart3, permission: "report:own" },
    ],
  },
  {
    title: "Boshqaruv",
    icon: Settings,
    items: [
      { label: "Xodimlar", href: "/employees", icon: UserCog, permission: "employee:manage" },
      { label: "Marketplace", href: "/admin/marketplace-settings", icon: Store, permission: "marketplace:manage" },
      { label: "Sozlamalar", href: "/admin/settings", icon: Settings, permission: "admin:settings" },
    ],
  },
];

// ===== Collapsible Section (Accordion) =====
function CollapsibleSection({
  section,
  visibleItems,
  pathname,
  sectionIndex,
  isOpen,
  onToggle,
  collapsed,
}: {
  section: NavSection;
  visibleItems: NavItem[];
  pathname: string;
  sectionIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  collapsed: boolean;
}) {
  const t = useT();
  const isItemActive = (item: NavItem): boolean => {
    const cleanPath = pathname.replace(/\/+$/, "");
    const cleanHref = item.href.replace(/\/+$/, "");
    return cleanPath === cleanHref;
  };

  const hasActiveItem = visibleItems.some(isItemActive);

  const contentRef = useRef<HTMLDivElement>(null);

  // Collapsed mode: show only icons with tooltip
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-0.5 py-0.5">
        {sectionIndex > 0 && <div className="w-6 h-px bg-white/10 my-1" />}
        {visibleItems.map((item) => {
          const isActive = isItemActive(item);
          return (
            <Link
              key={item.href}
              to={item.href}
              activeOptions={{ exact: true }}
              className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
                isActive
                  ? "bg-sidebar-active-bg text-white"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              }`}
              title={t(item.label)}
            >
              <item.icon size={18} strokeWidth={1.8} />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {sectionIndex > 0 && <div className="sidebar-divider" />}

      <button onClick={onToggle} className="sidebar-section-header">
        <section.icon size={16} className={hasActiveItem ? "text-indigo-400" : "text-slate-400"} />
        <span className={`flex-1 text-left ${hasActiveItem ? "!text-indigo-400" : ""}`}>
          {t(section.title)}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <div ref={contentRef}>
          {visibleItems.map((item) => {
            const isActive = isItemActive(item);
            return (
              <Link
                key={item.href}
                to={item.href}
                activeOptions={{ exact: true }}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <item.icon size={18} strokeWidth={1.8} />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== Edit Profile Modal =====
export function EditProfileModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) setFullName(user.fullName);
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () => trpc.auth.updateProfile.mutate({ fullName }),
    onSuccess: () => {
      useAuthStore.getState().updateProfile({ fullName });
      toast.success(getT()("Profil yangilandi"));
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const changePassword = useMutation({
    mutationFn: () => trpc.auth.changePassword.mutate({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success(getT()("Parol o'zgartirildi"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  function handlePasswordChange() {
    if (newPassword.length < 4) { toast.error(getT()("Parol kamida 4 belgi")); return; }
    if (newPassword !== confirmPassword) { toast.error(getT()("Parollar mos kelmadi")); return; }
    changePassword.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-lg font-semibold text-slate-900">{t("Profilni tahrirlash")}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-5">
          <div className="space-y-3">
            <label className="input-label">{t("To'liq ism")}</label>
            <input
              type="text"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <button
              className="btn-primary w-full"
              disabled={updateProfile.isPending || fullName === user?.fullName}
              onClick={() => updateProfile.mutate()}
            >
              <Save size={14} />
              {updateProfile.isPending ? t("Saqlanmoqda...") : t("Saqlash")}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={14} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700">{t("Parolni o'zgartirish")}</span>
            </div>
            <input
              type="password"
              className="input-field"
              placeholder={t("Joriy parol")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              className="input-field"
              placeholder={t("Yangi parol")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              className="input-field"
              placeholder={t("Yangi parolni tasdiqlash")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              className="btn w-full bg-slate-800 text-white hover:bg-slate-900 transition-colors"
              disabled={changePassword.isPending || !currentPassword || !newPassword}
              onClick={handlePasswordChange}
            >
              <Lock size={14} />
              {changePassword.isPending ? t("O'zgartirilmoqda...") : t("Parolni o'zgartirish")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Main Sidebar =====
export function Sidebar() {
  const t = useT();
  const { user, can } = useAuth();
  const { canInstall, install } = usePWA();
  const location = useLocation();
  const { mobileSidebarOpen, closeMobileSidebar, sidebarCollapsed } = useUIStore();

  // Accordion state
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Auto-open section with active route
  useEffect(() => {
    const cleanPath = location.pathname.replace(/\/+$/, "");
    for (const section of navSections) {
      const hasActive = section.items.some((item) => {
        const cleanHref = item.href.replace(/\/+$/, "");
        return cleanPath === cleanHref;
      });
      if (hasActive) {
        setOpenSection(section.title);
        break;
      }
    }
  }, [location.pathname]);

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname, closeMobileSidebar]);

  const handleSectionToggle = useCallback((title: string) => {
    setOpenSection((prev) => (prev === title ? null : title));
  }, []);

  if (!user) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileSidebarOpen ? "open" : ""}`}
        onClick={closeMobileSidebar}
      />

      <aside className={`sidebar ${mobileSidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Logo section — dark bg */}
        <div className={`sidebar-logo ${sidebarCollapsed ? "justify-center px-2" : ""}`}>
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            EZ
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="sidebar-logo-text">EZOZ MEBEL</div>
                <div className="text-[10px] text-slate-500">Savdo Boshqaruv</div>
              </div>
              <button
                onClick={closeMobileSidebar}
                className="lg:hidden text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={`sidebar-nav ${sidebarCollapsed ? "px-1" : ""}`}>
          {navSections.reduce<{ elements: React.ReactNode[]; visibleIndex: number }>(
            (acc, section) => {
              const visibleItems = section.items.filter(
                (item) => !item.permission || can(item.permission),
              );
              if (visibleItems.length === 0) return acc;

              acc.elements.push(
                <CollapsibleSection
                  key={section.title}
                  section={section}
                  visibleItems={visibleItems}
                  pathname={location.pathname}
                  sectionIndex={acc.visibleIndex}
                  isOpen={openSection === section.title}
                  onToggle={() => handleSectionToggle(section.title)}
                  collapsed={sidebarCollapsed}
                />,
              );
              acc.visibleIndex++;
              return acc;
            },
            { elements: [], visibleIndex: 0 },
          ).elements}
        </nav>

        {/* PWA Install */}
        {canInstall && !sidebarCollapsed && (
          <div className="px-3 pb-2">
            <button
              onClick={install}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition-colors"
            >
              <Download size={14} />
              {t("Ilovani o'rnatish")}
            </button>
          </div>
        )}

        {/* User section (minimal — full controls in Topbar) */}
        <div className={`sidebar-user ${sidebarCollapsed ? "flex-col gap-2 px-2 py-2" : ""}`}>
          <div className="w-8 h-8 bg-indigo-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user.fullName}</div>
              <div className="text-[10px] text-slate-500">{UserRoleLabels[user.role as UserRole]}</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
