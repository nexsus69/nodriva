"use client";

/** Renders a configured administrative surface without coupling layout to a module. */
import { useEffect, useRef, type ReactNode } from "react";
import type { AdminSurfaceDefinition } from "../AdminSurfaceDefinition";

const placementClasses = {
  left: "justify-start",
  right: "justify-end",
  center: "items-center justify-center p-4",
} as const;

const widthClasses = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-none",
} as const;

export function AdminSurfaceHost({
  definition,
  children,
  onClose,
  labelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: {
  definition: AdminSurfaceDefinition;
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (definition.presentation === "inline") return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [closeOnEscape, definition.presentation]);

  if (definition.presentation === "inline") {
    return <div className="w-full">{children}</div>;
  }

  const placement = definition.placement ?? "center";
  const isDrawer = definition.presentation === "drawer";
  const appearance = definition.appearance ?? "light";
  const width = widthClasses[definition.size ?? (isDrawer ? "lg" : "md")];
  const panelClassName = isDrawer
    ? `h-full w-full ${width} overflow-y-auto border-l border-slate-200 shadow-2xl shadow-slate-950/15 ${
        appearance === "dark" ? "bg-slate-950" : "bg-white"
      }`
    : `max-h-[calc(100dvh-3rem)] w-full ${width} overflow-y-auto border border-slate-200 shadow-2xl shadow-slate-950/15 ${
        appearance === "dark" ? "bg-slate-950" : "bg-white"
      }`;

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-slate-950/35 backdrop-blur-[1px] ${
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
        ref={panelRef}
        tabIndex={-1}
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
