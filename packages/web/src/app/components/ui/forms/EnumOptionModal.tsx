"use client";

/** Renders the managed-enum nested draft through the same builder and modal surface as other forms. */
import type { FormEvent } from "react";
import { useMemo } from "react";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { FormModal } from "./FormModal";
import { createValidationMessages, defineForm, type FormDefinition } from "./FormDefinition";
import type { EnumOptionDraftValues } from "./useManagedEnumOptionForm";
import type { UserMutationFailure } from "@/app/mutations/useUserMutation";

/** Builds the declarative contract for a new managed enum option. */
export function createEnumOptionDefinition(t: (key: string) => string): FormDefinition {
  return defineForm({
    key: "managed-enum-option",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [
      {
        name: "value",
        type: "text",
        label: t("enum.technicalValueLabel"),
        description: t("enum.technicalValueHelp"),
        placeholder: t("enum.technicalValuePlaceholder"),
        required: true,
        // HTML patterns use the Unicode Sets (`v`) flag: the hyphen must be escaped.
        validation: { minLength: 1, maxLength: 100, pattern: "^[a-z][a-z0-9_\\-]*$" },
      },
      {
        name: "label",
        type: "text",
        label: t("enum.labelLabel"),
        description: t("enum.labelHelp"),
        placeholder: t("enum.labelPlaceholder"),
        required: true,
        validation: { minLength: 1, maxLength: 150 },
      },
    ],
  });
}

export interface EnumOptionModalProps {
  open: boolean;
  values: EnumOptionDraftValues;
  isDirty: boolean;
  pending: boolean;
  failure: UserMutationFailure | null;
  theme: "dark" | "light";
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
  onClose: () => void;
  onDiscard: () => void;
}

export function EnumOptionModal({
  open,
  values,
  isDirty,
  pending,
  failure,
  theme,
  onChange,
  onSubmit,
  onRetry,
  onClose,
  onDiscard,
}: EnumOptionModalProps) {
  const { t } = useAppLocale();
  const definition = useMemo(() => createEnumOptionDefinition(t), [t]);
  return (
    <FormModal
      open={open}
      title={t("enum.newOption")}
      isDirty={isDirty}
      definition={definition}
      values={{ ...values }}
      onChange={onChange}
      onSubmit={onSubmit}
      isPending={pending}
      mutationFailure={failure}
      onRetryMutation={onRetry}
      theme={theme}
      submitLabel={t("enum.saveOption")}
      pendingLabel={t("common.saving")}
      cancelLabel={t("common.cancel")}
      onDiscard={onDiscard}
      onClose={onClose}
    />
  );
}
