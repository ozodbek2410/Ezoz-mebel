import { type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// Table Root
interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`data-table ${className}`}>{children}</table>
      </div>
    </div>
  );
}

// Table Head
export function TableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

// Table Body
export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

// Table Row
interface TableRowProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TableRow({ children, active, onClick, className = "" }: TableRowProps) {
  return (
    <tr className={`${active ? "active" : ""} ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

// Sortable Header Cell
type SortDir = "asc" | "desc" | null;

interface SortableThProps {
  children: ReactNode;
  sortDir?: SortDir;
  onSort?: () => void;
  className?: string;
}

export function SortableTh({ children, sortDir, onSort, className = "" }: SortableThProps) {
  return (
    <th
      className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}
      onClick={onSort}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortDir === "asc" && <ChevronUp className="w-3.5 h-3.5" />}
        {sortDir === "desc" && <ChevronDown className="w-3.5 h-3.5" />}
        {sortDir === null && onSort && <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />}
      </div>
    </th>
  );
}

// Empty State
interface TableEmptyProps {
  colSpan: number;
  message?: string;
  icon?: ReactNode;
}

export function TableEmpty({ colSpan, message = "Ma'lumot topilmadi", icon }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-gray-400">
        <div className="flex flex-col items-center gap-2">
          {icon && <div className="text-gray-300">{icon}</div>}
          <p>{message}</p>
        </div>
      </td>
    </tr>
  );
}

// Loading State
export function TableLoading({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: colSpan }).map((_, j) => (
            <td key={j} className="py-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
