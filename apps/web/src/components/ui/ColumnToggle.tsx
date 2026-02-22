import { useState, useRef, useEffect } from "react";
import { Settings2 } from "lucide-react";

interface Column {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnToggleProps {
  columns: Column[];
  onToggle: (key: string) => void;
}

export function ColumnToggle({ columns, onToggle }: ColumnToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg border bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        title="Ustunlarni sozlash"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border rounded-xl shadow-lg py-2 min-w-[200px]">
          <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">Ustunlar</p>
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => onToggle(col.key)}
                className="rounded border-gray-300 text-brand-600"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
