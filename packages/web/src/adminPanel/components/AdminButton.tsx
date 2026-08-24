/** Provides the single visual and interaction contract for Admin actions. */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AdminIcon } from "./AdminIcon";

export type AdminButtonTone = "primary" | "secondary" | "quiet" | "danger";

const toneClasses: Record<AdminButtonTone, string> = {
  primary: "border-violet-600 bg-violet-600 text-white hover:border-violet-700 hover:bg-violet-700",
  secondary: "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
  quiet: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700",
};

/** Renders a compact Admin button with optional canonical icon. */
export function AdminButton({
  children,
  tone = "secondary",
  icon,
  compact = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: AdminButtonTone;
  icon?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center justify-center gap-2 border font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none ${compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"} ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {icon && <AdminIcon name={icon} className="size-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
}
