"use client";

/** Renders a configured administrative surface without coupling layout to a module. */
import type { ReactNode } from "react";
import type { AdminSurfaceDefinition } from "../AdminSurfaceDefinition";

const placementClasses = {
  left: "justify-start",
  right: "justify-end",
  center: "items-center justify-center p-4",
} as const;

export function AdminSurfaceHost({
  definition,
  children,
  onClose,
  labelledBy,
  closeOnBackdrop = true,
}: {
  definition: AdminSurfaceDefinition;
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
  closeOnBackdrop?: boolean;
}) {
  if (definition.presentation === "inline") {
    return <div className="w-full">{children}</div>;
  }

  const placement = definition.placement ?? "center";
  const isDrawer = definition.presentation === "drawer";
  const appearance = definition.appearance ?? "light";
  const panelClassName = isDrawer
    ? `h-full w-full max-w-md overflow-y-auto p-6 shadow-2xl ${
        appearance === "dark" ? "bg-slate-950" : "bg-white"
      }`
    : `max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl ${
        appearance === "dark" ? "bg-slate-950" : "bg-white"
      }`;

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-slate-950/25 ${
        isDrawer
          ? placementClasses[placement === "center" ? "right" : placement]
          : placementClasses[placement]
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </aside>
    </div>
  );
}
