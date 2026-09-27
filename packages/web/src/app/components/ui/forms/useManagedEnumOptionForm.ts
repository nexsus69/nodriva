"use client";

/** Owns nested managed-enum drafts and their mutation lifecycle for a parent resource form. */
import { useCallback, useMemo, useState } from "react";
import { AppCache } from "../../../cache/GlobalCacheClient";
import { useAppLocale } from "../../../i18n/AppLocaleStore";
import { useUserMutation } from "../../../mutations/useUserMutation";

export interface ManagedEnumOption {
  id: string;
  value: string;
  label: string;
  position: number;
  isActive: boolean;
}

export interface ManagedEnumField {
  id?: string | null;
}

export interface EnumOptionDraftValues {
  value: string;
  label: string;
}

export const EMPTY_ENUM_OPTION_DRAFT: Readonly<EnumOptionDraftValues> = {
  value: "",
  label: "",
};

/** Reads a stable nested draft without exposing mutable shared defaults. */
export function readEnumOptionDraft(
  drafts: Readonly<Record<string, EnumOptionDraftValues>>,
  fieldId: string | null | undefined,
): EnumOptionDraftValues {
  if (!fieldId) return { ...EMPTY_ENUM_OPTION_DRAFT };
  return drafts[fieldId] ?? { ...EMPTY_ENUM_OPTION_DRAFT };
}

/** Updates one nested enum draft while preserving drafts belonging to other fields. */
export function updateEnumOptionDraft(
  drafts: Readonly<Record<string, EnumOptionDraftValues>>,
  fieldId: string,
  name: keyof EnumOptionDraftValues,
  value: string,
): Record<string, EnumOptionDraftValues> {
  return {
    ...drafts,
    [fieldId]: { ...readEnumOptionDraft(drafts, fieldId), [name]: value },
  };
}

/** Removes exactly one nested draft after an explicit discard or a successful save. */
export function removeEnumOptionDraft(
  drafts: Readonly<Record<string, EnumOptionDraftValues>>,
  fieldId: string,
): Record<string, EnumOptionDraftValues> {
  const remaining = { ...drafts };
  delete remaining[fieldId];
  return remaining;
}

/** Identifies whether any preserved nested enum draft must block parent navigation. */
export function hasDirtyEnumOptionDraft(
  drafts: Readonly<Record<string, EnumOptionDraftValues>>,
): boolean {
  return Object.values(drafts).some(hasDirtyEnumOptionValues);
}

/** Identifies whether the currently visible nested draft requires a discard confirmation. */
export function hasDirtyEnumOptionValues(draft: EnumOptionDraftValues): boolean {
  return draft.value.trim() !== "" || draft.label.trim() !== "";
}

/** Coordinates the enum form without letting the modal own duplicate local state. */
export function useManagedEnumOptionForm<TField extends ManagedEnumField>({
  kind,
  typeKey,
  onOptionAdded,
}: {
  kind: "node" | "entity";
  typeKey: string;
  onOptionAdded: (field: TField, option: ManagedEnumOption) => void;
}) {
  const [field, setField] = useState<TField | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EnumOptionDraftValues>>({});
  const { t } = useAppLocale();
  const mutation = useUserMutation();
  const fieldId = field?.id ?? null;
  const values = useMemo(() => readEnumOptionDraft(drafts, fieldId), [drafts, fieldId]);

  const open = useCallback((nextField: TField) => {
    if (!nextField.id) return;
    setDrafts((current) => current[nextField.id!] ? current : {
      ...current,
      [nextField.id!]: { ...EMPTY_ENUM_OPTION_DRAFT },
    });
    setField(nextField);
  }, []);

  /** Closes only the presentation surface: its typed draft remains owned by the parent form. */
  const close = useCallback(() => setField(null), []);

  const change = useCallback((name: string, value: unknown) => {
    if (!fieldId || (name !== "value" && name !== "label")) return;
    setDrafts((current) => updateEnumOptionDraft(current, fieldId, name, String(value)));
  }, [fieldId]);

  const clear = useCallback((targetFieldId: string) => {
    setDrafts((current) => removeEnumOptionDraft(current, targetFieldId));
    setField((current) => current?.id === targetFieldId ? null : current);
  }, []);

  const discard = useCallback(() => {
    if (fieldId) setDrafts((current) => removeEnumOptionDraft(current, fieldId));
  }, [fieldId]);

  /** Disposes every nested enum draft when its owning resource form is discarded. */
  const reset = useCallback(() => {
    setField(null);
    setDrafts({});
    mutation.clear();
  }, [mutation]);

  const submit = useCallback(async () => {
    if (!field || !fieldId) return;
    const submittedValues = readEnumOptionDraft(drafts, fieldId);
    await mutation.execute(async () => {
      const result = await AppCache.admin.addEnumOption(
        kind,
        typeKey,
        fieldId,
        submittedValues.value.trim(),
        submittedValues.label.trim(),
      );
      if (!result.success || !result.data) {
        throw result.error ?? { code: "INTERNAL_ERROR", message: t("enum.addError") };
      }
      return result.data;
    }, (option) => {
      onOptionAdded(field, option);
      clear(fieldId);
    }, { successKey: 'mutation.enumOptionAdded' });
  }, [clear, drafts, field, fieldId, kind, mutation, onOptionAdded, t, typeKey]);

  return {
    field,
    values,
    open,
    close,
    change,
    discard,
    reset,
    submit,
    pending: mutation.pending,
    failure: mutation.failure,
    retry: () => void mutation.retry(),
    isDirty: hasDirtyEnumOptionDraft(drafts),
    isCurrentDirty: hasDirtyEnumOptionValues(values),
  };
}
