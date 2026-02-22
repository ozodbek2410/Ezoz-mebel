import { Badge } from "@/components/ui";

type StatusType =
  | "OPEN" | "COMPLETED" | "CANCELLED" | "RETURNED"
  | "PENDING" | "IN_PROGRESS"
  | "NEW" | "PAYMENT_PENDING";

const statusConfig: Record<StatusType, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  NEW: { label: "Yangi", variant: "info" },
  OPEN: { label: "Ochiq", variant: "info" },
  PENDING: { label: "Kutilmoqda", variant: "warning" },
  IN_PROGRESS: { label: "Bajarilmoqda", variant: "info" },
  PAYMENT_PENDING: { label: "To'lov kutilmoqda", variant: "warning" },
  COMPLETED: { label: "Yakunlangan", variant: "success" },
  CANCELLED: { label: "Bekor qilingan", variant: "danger" },
  RETURNED: { label: "Qaytarilgan", variant: "danger" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || { label: status, variant: "neutral" as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
