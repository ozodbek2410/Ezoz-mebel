import { type ReactNode } from "react";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  danger: "alert-danger",
};

const icons: Record<AlertVariant, ReactNode> = {
  info: <Info className="w-5 h-5 shrink-0" />,
  success: <CheckCircle className="w-5 h-5 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 shrink-0" />,
  danger: <AlertCircle className="w-5 h-5 shrink-0" />,
};

export function Alert({ variant = "info", children, className = "" }: AlertProps) {
  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {icons[variant]}
      <div className="text-sm">{children}</div>
    </div>
  );
}
