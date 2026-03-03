import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

export function ContextMenu({ open, x, y, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleScroll() {
      onClose();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menu.style.top = `${y - rect.height}px`;
    }
  }, [open, x, y]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-in fade-in"
      style={{ left: x, top: y }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface ContextMenuItemProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export function ContextMenuItem({ icon, label, onClick, variant = "default", disabled = false }: ContextMenuItemProps) {
  return (
    <button
      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
        disabled
          ? "text-slate-300 cursor-not-allowed"
          : variant === "danger"
            ? "text-red-600 hover:bg-red-50"
            : "text-slate-700 hover:bg-slate-50"
      }`}
      onClick={() => { if (!disabled) onClick(); }}
      disabled={disabled}
    >
      {icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>}
      {label}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="border-t border-slate-100 my-1" />;
}
