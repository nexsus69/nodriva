"use client";

/** Composes an accessible modal surface and the shared definition-driven form builder. */
import type { FormEvent, ReactNode } from "react";
import { useCallback } from "react";
import { confirmDiscardFormDraft } from "../../../navigation/NavigationBlocker";
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
  /** Reports whether this modal currently owns user changes that have not been saved. */
  isDirty?: boolean;
  onClose: () => void;
  /** Removes the draft only after the shared discard confirmation succeeds. */
  onDiscard?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
}

export function FormModal({
  open,
  title,
  isDirty = false,
  onClose,
  onDiscard,
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
  const requestClose = useCallback(async () => {
    if (isDirty && !(await confirmDiscardFormDraft())) return;
    if (isDirty) onDiscard?.();
    onClose();
  }, [isDirty, onClose, onDiscard]);

  return (
    <ModalShell open={open} title={title} onClose={() => { void requestClose(); }} appearance={theme}>
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
        onCancel={() => { void requestClose(); }}
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
