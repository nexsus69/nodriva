"use client";

/** Owns data loading and mutations for a type detail workspace. */
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorResponse,
  FieldDto,
  TypeDetailDto,
  TypeKind,
} from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { EMPTY_FIELD, type FieldForm } from "./typeDetailModel";

export function useTypeDetailController(
  kind: TypeKind,
  typeKey: string,
  t: (key: string) => string,
) {
  const [detail, setDetail] = useState<TypeDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await AppCache.admin.getTypeDetail(kind, typeKey);
    if (result.success && result.data) {
      setDetail(result.data);
    } else setError(result.error ?? null);
    setLoading(false);
  }, [kind, typeKey]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const mutate = useCallback(
    async (
      operation: () => Promise<{
        success: boolean;
        data?: TypeDetailDto;
        error?: ApiErrorResponse;
      }>,
    ) => {
      setPending(true);
      setFormError(null);
      const result = await operation();
      if (result.success && result.data) {
        setDetail(result.data);
      } else setFormError(result.error ?? null);
      setPending(false);
      return result.success;
    },
    [],
  );

  const saveMetadata = useCallback(
    async (
      event: React.FormEvent<HTMLFormElement>,
      metadata: { name: string; description: string },
    ) => {
      event.preventDefault();
      if (!detail) return false;
      return mutate(() =>
        AppCache.admin.updateType(kind, typeKey, {
          ...metadata,
          expectedRowVersion: detail.rowVersion,
        }),
      );
    },
    [detail, kind, mutate, typeKey],
  );

  const saveField = useCallback(
    async (field: FieldForm, editingFieldId: string | null) => {
      if (!detail) return false;
      if (editingFieldId)
        return mutate(() =>
          AppCache.admin.updateField(kind, typeKey, {
            fieldId: editingFieldId,
            label: field.label,
            isRequired: field.isRequired,
            isUnique: field.isUnique,
            isIndexed: field.isIndexed,
            defaultValueText: field.defaultValueText || null,
            encryptionMode: field.encryptionMode,
            expectedTypeRowVersion: detail.rowVersion,
          }),
        );
      return mutate(() =>
        AppCache.admin.createField(kind, typeKey, {
          ...field,
          relationTargetDomain: field.relationTargetDomain || undefined,
          relationTargetTypeKey: field.relationTargetTypeKey || undefined,
          relationSourceCardinality: field.relationSourceCardinality,
          relationTargetIsUnique: field.relationTargetIsUnique,
          relationInverseLabel: field.relationInverseLabel || null,
          enumMode: field.enumMode || undefined,
          defaultValueText: field.defaultValueText || null,
          expectedTypeRowVersion: detail.rowVersion,
          position: detail.fields.length,
        }),
      );
    },
    [detail, kind, mutate, typeKey],
  );

  const removeField = useCallback(
    async (field: FieldDto) => {
      if (!detail) return false;
      const confirmed = await requestConfirmation({
        title: t("admin.deleteFieldTitle"),
        description: t("admin.deleteFieldDescription"),
        confirmLabel: t("admin.delete"),
        cancelLabel: t("admin.cancel"),
        tone: "danger",
      });
      if (!confirmed) return false;
      return mutate(() =>
        AppCache.admin.deleteField(kind, typeKey, {
          fieldId: field.id,
          expectedTypeRowVersion: detail.rowVersion,
        }),
      );
    },
    [detail, kind, mutate, t, typeKey],
  );

  const moveField = useCallback(
    async (fieldId: string, direction: -1 | 1) => {
      if (!detail) return false;
      const ordered = [...detail.fields].sort(
        (left, right) => left.position - right.position,
      );
      const index = ordered.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return false;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return mutate(() =>
        AppCache.admin.reorderFields(kind, typeKey, {
          orderedFieldIds: ordered.map((field) => field.id),
          expectedTypeRowVersion: detail.rowVersion,
        }),
      );
    },
    [detail, kind, mutate, typeKey],
  );

  return {
    detail,
    loading,
    error,
    formError,
    pending,
    load,
    saveMetadata,
    saveField,
    removeField,
    moveField,
    emptyField: EMPTY_FIELD,
  };
}
