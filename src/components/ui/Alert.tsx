import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "success" | "warning" | "danger" | "info" | "neutral";

// Text shades follow Badge: amber-800 / red-700 on the light washes, since
// the base warning/danger tokens fall short of AA there.
const TONES: Record<AlertTone, { box: string; icon: string; Icon: LucideIcon; role: "status" | "alert" | "note" | undefined }> = {
  success: { box: "border-success/30 bg-success-light", icon: "text-success", Icon: CheckCircle2, role: "status" },
  warning: { box: "border-warning/40 bg-warning-light", icon: "text-amber-800", Icon: AlertTriangle, role: "note" },
  danger: { box: "border-danger/30 bg-danger-light", icon: "text-red-700", Icon: XCircle, role: "alert" },
  info: { box: "border-info/20 bg-info-light", icon: "text-info", Icon: Info, role: "status" },
  neutral: { box: "border-neutral-200 bg-white", icon: "text-neutral-500", Icon: Info, role: undefined },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  // Replaces the tone's default icon.
  icon?: LucideIcon;
  // Defaults by tone: success/info "status", warning "note", danger
  // "alert" (announced at once - keep it for real errors), neutral none.
  role?: "status" | "alert" | "note" | null;
  // Buttons or links for what to do next - right-aligned on wide screens,
  // under the message on phones.
  actions?: ReactNode;
  className?: string;
}

// A message about the page or an action's outcome. Replaces the
// hand-written success/warning/info boxes - same look, one component.
export function Alert({ tone = "info", title, children, icon, role, actions, className }: AlertProps) {
  const t = TONES[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div
      role={role === null ? undefined : (role ?? t.role)}
      className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", t.box, className)}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", t.icon)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title && <p className="font-semibold text-neutral-900">{title}</p>}
          {children && <div className={cn("text-neutral-800", title && "mt-0.5")}>{children}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
