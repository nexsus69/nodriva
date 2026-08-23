"use client";

/** Provides the generic modal shell for any definition-driven administrative form. */
import type { FormEvent } from "react";
import { FormRenderer, type FormDefinition } from "@/app/components/ui/forms";
import type { AdminSurfaceDefinition } from "../AdminSurfaceDefinition";
import { AdminSurfaceHost } from "./AdminSurfaceHost";

/** Default surface configuration used by form dialogs without a custom layout. */
export const ADMIN_FORM_DIALOG_SURFACE: AdminSurfaceDefinition = {
  key: "form-dialog",
  moduleKey: "admin",
  tabs: [],
  initialTab: "",
  presentation: "modal",
  placement: "center",
  appearance: "light",
  initialState: {},
};

export function AdminFormDialog({
  title,
  definition,
  values,
  pending,
  submitLabel,
  cancelLabel,
  onChange,
  onSubmit,
  onClose,
  surface = ADMIN_FORM_DIALOG_SURFACE,
}: {
  title: string;
  definition: FormDefinition;
  values: Record<string, unknown>;
  pending: boolean;
  submitLabel: string;
  cancelLabel: string;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  surface?: AdminSurfaceDefinition;
}) {
  return (
    <AdminSurfaceHost
      definition={surface}
      onClose={onClose}
      labelledBy="admin-form-dialog-title"
    >
        <div className="mb-5 flex items-start justify-between border-b border-slate-200 pb-4">
          <h2
            id="admin-form-dialog-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-slate-400"
            aria-label={cancelLabel}
          >
            ×
          </button>
        </div>
        <FormRenderer
          definition={definition}
          values={values}
          onChange={onChange}
          onSubmit={onSubmit}
          isPending={pending}
          theme={surface.appearance === "light" ? "light" : "dark"}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          onCancel={onClose}
        />
    </AdminSurfaceHost>
  );
}
