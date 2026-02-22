import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerLeft?: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl";
}

const widthClasses = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function SlideOver({ open, onClose, title, subtitle, children, headerLeft, footer, width = "lg" }: SlideOverProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      ref={overlayRef}
      className={`slide-over-overlay ${open ? "open" : ""}`}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={`slide-over-panel ${widthClasses[width]} ${open ? "open" : ""}`} role="dialog" aria-modal="true">
        <div className="slide-over-header">
          <div className="flex items-center gap-3 min-w-0">
            {headerLeft}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="slide-over-body">{children}</div>
        {footer && <div className="slide-over-footer">{footer}</div>}
      </div>
    </div>
  );
}
