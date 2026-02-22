import { type ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
};

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return <span className={`${variantClasses[variant]} ${className}`}>{children}</span>;
}
