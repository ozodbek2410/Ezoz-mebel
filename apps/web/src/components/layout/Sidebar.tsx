import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePWA } from "@/hooks/usePWA";
import { useUIStore } from "@/store/ui.store";
import { UserRoleLabels, type Permission } from "@ezoz/shared";
import type { UserRole } from "@ezoz/shared";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth.store";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Wrench,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  Store,
  LogOut,
  Clock,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
  Save,
  Lock,
  Scissors,
  Menu,
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
      { label: "Xizmatlar", href: "/services", icon: Scissors, permission: "sale:service" },
      { label: "Savdo kassasi", href: "/sales", icon: ShoppingCart, permission: "sale:product" },
      { label: "Xizmat kassasi", href: "/sales/service", icon: Wrench, permission: "sale:service" },
      { label: "Ustaxona", href: "/workshop", icon: Clock, permission: "workshop:view" },
      { label: "Ombor", href: "/warehouse", icon: Warehouse, permission: "warehouse:read" },
    ],
  },
  {
    title: "Moliya",
    icon: Wallet,
    items: [
      { label: "Cheklar", href: "/receipts", icon: Receipt, permission: "receipt:print" },
      { label: "Xarajatlar", href: "/expenses", icon: Wallet, permission: "expense:create" },
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
  const isItemActive = (item: NavItem): boolean => {
    const cleanPath = pathname.replace(/\/+$/, "");
    const cleanHref = item.href.replace(/\/+$/, "");
    return cleanPath === cleanHref;
  };

  const hasActiveItem = visibleItems.some(isItemActive);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [visibleItems.length]);

  // Collapsed mode: show only section icon
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
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white shadow-sm shadow-brand-500/20"
                  : "text-gray-400 hover:bg-sidebar-hover hover:text-white"
              }`}
              title={item.label}
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
        <section.icon size={16} className={hasActiveItem ? "text-brand-400" : "text-gray-300"} />
        <span className={`flex-1 text-left ${hasActiveItem ? "!text-brand-400" : ""}`}>
          {section.title}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: isOpen ? `${contentHeight}px` : "0px" }}
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
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== Edit Profile Modal =====
function EditProfileModal({ onClose }: { onClose: () => void }) {
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
      toast.success("Profil yangilandi");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const changePassword = useMutation({
    mutationFn: () => trpc.auth.changePassword.mutate({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success("Parol o'zgartirildi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  function handlePasswordChange() {
    if (newPassword.length < 4) { toast.error("Parol kamida 4 belgi"); return; }
    if (newPassword !== confirmPassword) { toast.error("Parollar mos kelmadi"); return; }
    changePassword.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full sm:w-[400px] max-h-[90vh] mx-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Profilni tahrirlash</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Profile section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">To'liq ism</label>
            <input
              type="text"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              disabled={updateProfile.isPending || fullName === user?.fullName}
              onClick={() => updateProfile.mutate()}
            >
              <Save size={14} />
              {updateProfile.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>

          {/* Password section */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Parolni o'zgartirish</span>
            </div>
            <input
              type="password"
              className="input-field"
              placeholder="Joriy parol"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              className="input-field"
              placeholder="Yangi parol"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              className="input-field"
              placeholder="Yangi parolni tasdiqlash"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              disabled={changePassword.isPending || !currentPassword || !newPassword}
              onClick={handlePasswordChange}
            >
              <Lock size={14} />
              {changePassword.isPending ? "O'zgartirilmoqda..." : "Parolni o'zgartirish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Mobile Hamburger Button =====
export function MobileMenuButton() {
  const { toggleMobileSidebar } = useUIStore();
  return (
    <button
      onClick={toggleMobileSidebar}
      className="lg:hidden p-2 -ml-2 mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
    >
      <Menu size={22} />
    </button>
  );
}

// ===== Main Sidebar =====
export function Sidebar() {
  const { user, logout, can } = useAuth();
  const { canInstall, install } = usePWA();
  const location = useLocation();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const { mobileSidebarOpen, closeMobileSidebar, sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();

  // Accordion: only one section open at a time, default all closed
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Auto-open section that contains active route
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
        {/* Logo */}
        <div className={`sidebar-logo ${sidebarCollapsed ? "justify-center px-2" : ""}`}>
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            EZ
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1">
                <div className="sidebar-logo-text">EZOZ MEBEL</div>
                <div className="text-[11px] text-gray-500">Savdo Boshqaruv</div>
              </div>
              <button
                onClick={toggleSidebarCollapsed}
                className="hidden lg:flex text-gray-500 hover:text-white p-1 transition-colors"
                title="Yig'ish"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={closeMobileSidebar}
                className="lg:hidden text-gray-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </>
          )}
          {sidebarCollapsed && (
            <button
              onClick={toggleSidebarCollapsed}
              className="hidden lg:flex absolute right-1 top-5 text-gray-500 hover:text-white p-1 transition-colors"
              title="Kengaytirish"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
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
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors"
            >
              <Download size={14} />
              Ilovani o'rnatish
            </button>
          </div>
        )}

        {/* User section */}
        <div className={`sidebar-user ${sidebarCollapsed ? "flex-col gap-2 px-2" : ""}`}>
          <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user.fullName}</div>
                <div className="text-[11px] text-gray-500">{UserRoleLabels[user.role as UserRole]}</div>
              </div>
              <button
                onClick={() => setEditProfileOpen(true)}
                className="text-gray-500 hover:text-brand-400 transition-colors p-1"
                title="Tahrirlash"
              >
                <Edit2 size={14} />
              </button>
            </>
          )}
          <button
            onClick={logout}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
            title="Chiqish"
          >
            <LogOut size={16} />
          </button>
        </div>

        {editProfileOpen && <EditProfileModal onClose={() => setEditProfileOpen(false)} />}
      </aside>
    </>
  );
}
