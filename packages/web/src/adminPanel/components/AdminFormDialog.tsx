"use client";

/** Provides the generic modal shell for any definition-driven administrative form. */
import type { FormEvent } from "react";
import { FormRenderer, type FormDefinition } from "@/app/components/ui/forms";

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
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-form-dialog-title"
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
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
