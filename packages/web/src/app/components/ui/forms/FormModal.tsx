"use client";

/** Composes an accessible modal surface and the shared definition-driven form builder. */
import type { FormEvent, ReactNode } from "react";
import { ModalShell } from "../feedback/ModalShell";
import { FormRenderer, type FormRendererProps } from "./FormRenderer";

export interface FormModalProps extends Pick<
  FormRendererProps,
  "definition" | "values" | "onChange" | "isPending" | "submitDisabled"
  | "submitLabel" | "pendingLabel" | "cancelLabel" | "destructiveAction"
  | "mutationFailure" | "onRetryMutation" | "theme"
> {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
}

export function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  definition,
  values,
  onChange,
  isPending,
  submitDisabled,
  submitLabel,
  pendingLabel,
  cancelLabel,
  destructiveAction,
  mutationFailure,
  onRetryMutation,
  theme,
  children,
}: FormModalProps) {
  return (
    <ModalShell open={open} title={title} onClose={onClose} appearance={theme}>
      <FormRenderer
        definition={definition}
        values={values}
        onChange={onChange}
        onSubmit={onSubmit}
        isPending={isPending}
        submitDisabled={submitDisabled}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        cancelLabel={cancelLabel}
        onCancel={onClose}
        destructiveAction={destructiveAction}
        mutationFailure={mutationFailure}
        onRetryMutation={onRetryMutation}
        theme={theme}
      >
        {children}
      </FormRenderer>
    </ModalShell>
  );
}
