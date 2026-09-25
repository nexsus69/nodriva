"use client";

/** Provides the generic modal shell for any definition-driven administrative form. */
import type { FormEvent, ReactNode } from "react";
import { FormRenderer, type FormDefinition } from "@/app/components/ui/forms";
import type { AdminSurfaceDefinition } from "../AdminSurfaceDefinition";
import { AdminSurfaceHost } from "./AdminSurfaceHost";
import { AdminSurfaceHeader } from "./AdminSurfaceHeader";
import { ADMIN_THEME } from "@/Theme";
import type { UserMutationFailure } from "@/app/mutations/useUserMutation";

/** Default surface configuration used by form dialogs without a custom layout. */
export const ADMIN_FORM_DIALOG_SURFACE: AdminSurfaceDefinition = {
  key: "form-dialog",
  moduleKey: "admin",
  tabs: [],
  initialTab: "",
  presentation: "modal",
  placement: "center",
  size: "md",
  appearance: ADMIN_THEME.appearance,
  initialState: {},
};

export function AdminFormDialog({
  title,
  definition,
  values,
  pending,
  submitDisabled = false,
  submitLabel,
  cancelLabel,
  onChange,
  onSubmit,
  onClose,
  surface = ADMIN_FORM_DIALOG_SURFACE,
  children,
  error,
  mutationFailure,
  onRetryMutation,
}: {
  title: string;
  definition: FormDefinition;
  values: Record<string, unknown>;
  pending: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
  cancelLabel: string;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  surface?: AdminSurfaceDefinition;
  children?: ReactNode;
  error?: string;
  mutationFailure?: UserMutationFailure | null;
  onRetryMutation?: () => void;
}) {
  return (
    <AdminSurfaceHost
      definition={surface}
      onClose={onClose}
      labelledBy="admin-form-dialog-title"
    >
      <div className="min-h-full">
        <AdminSurfaceHeader
          title={title}
          titleId="admin-form-dialog-title"
          closeLabel={cancelLabel}
          onClose={onClose}
          appearance={ADMIN_THEME.appearance}
        />
        <div className="p-6">
        <FormRenderer
          definition={definition}
          values={values}
          onChange={onChange}
          onSubmit={onSubmit}
          isPending={pending}
          submitDisabled={submitDisabled}
          error={error}
          mutationFailure={mutationFailure}
          onRetryMutation={onRetryMutation}
          theme={ADMIN_THEME.form}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          onCancel={onClose}
          actionPlacement="sticky"
        >
          {children}
        </FormRenderer>
        </div>
      </div>
    </AdminSurfaceHost>
  );
}
