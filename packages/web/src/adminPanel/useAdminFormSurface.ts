"use client";

import { useCallback, useMemo } from "react";
import type { SetStateAction } from "react";
import {
  useAdminWorkspaceStore,
  type AdminFormDraft,
  type AdminSurfaceState,
} from "./AdminWorkspaceStore";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useUnsavedChanges } from "@/app/navigation/NavigationBlocker";

/** Defines how a form surface treats an unsaved draft when it is closed. */
export type AdminFormClosePolicy = "preserve" | "discard";

/** Configures the shared persistence and close behavior of an Admin Panel form. */
export interface AdminFormSurfaceOptions<T extends object> {
  moduleKey: string;
  surfaceKey: string;
  surfaceKind: Extract<AdminSurfaceState["kind"], "modal" | "drawer">;
  draftKey: string;
  formVersion: string;
  initialValues: T;
  closePolicy?: AdminFormClosePolicy;
  confirmOnDiscard?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmConfirmLabel?: string;
  confirmCancelLabel?: string;
}

/** Identifies the operation restored together with a form surface. */
export interface AdminFormSurfaceIdentity {
  mode?: "create" | "edit";
  resourceId?: string;
}

/** Resolves an open form from its stable surface identity and persisted draft. */
export function resolveAdminFormSurfaceState<T extends object>({
  initialValues,
  draft,
  surface,
  moduleKey,
  surfaceKey,
}: {
  initialValues: T;
  draft?: AdminFormDraft;
  surface: AdminSurfaceState | null;
  moduleKey: string;
  surfaceKey: string;
}) {
  const values = { ...initialValues, ...(draft?.values as Partial<T> | undefined) };
  const baseline = draft?.baseline ?? (initialValues as Record<string, unknown>);
  const isOpen = surface?.moduleKey === moduleKey && surface.key === surfaceKey;
  return { values, isOpen, isDirty: draft !== undefined && !areValuesEqual(values, baseline) };
}

/** Exposes a reload-safe form surface with configurable draft cleanup semantics. */
export function useAdminFormSurface<T extends object>({
  moduleKey,
  surfaceKey,
  surfaceKind,
  draftKey,
  formVersion,
  initialValues,
  closePolicy = "discard",
  confirmOnDiscard = false,
  confirmTitle,
  confirmDescription,
  confirmConfirmLabel,
  confirmCancelLabel,
}: AdminFormSurfaceOptions<T>) {
  const { t } = useAppLocale();
  const resolvedConfirmTitle = confirmTitle ?? t("admin.discardTitle");
  const resolvedConfirmDescription = confirmDescription ?? t("admin.discardDescription");
  const resolvedConfirmConfirmLabel = confirmConfirmLabel ?? t("admin.discardChanges");
  const resolvedConfirmCancelLabel = confirmCancelLabel ?? t("admin.keepEditing");
  const draft = useAdminWorkspaceStore((state) => state.drafts[draftKey]);
  const surface = useAdminWorkspaceStore((state) => state.surface);
  const openSurface = useAdminWorkspaceStore((state) => state.openSurface);
  const closeSurface = useAdminWorkspaceStore((state) => state.closeSurface);
  const saveDraft = useAdminWorkspaceStore((state) => state.saveDraft);
  const removeDraft = useAdminWorkspaceStore((state) => state.removeDraft);
  const resolvedState = useMemo(
    () => resolveAdminFormSurfaceState({ initialValues, draft, surface, moduleKey, surfaceKey }),
    [draft, initialValues, moduleKey, surface, surfaceKey],
  );
  const { values, isOpen, isDirty } = resolvedState;
  // A draft is dirty only when its values differ from the initial form state.
  // This lets a user type, clear the field, and close without a false warning.
  useUnsavedChanges(isDirty);

  /** Opens the configured modal or drawer without changing its draft. */
  const open = useCallback(
    (identity: AdminFormSurfaceIdentity = {}) =>
      openSurface({
        kind: surfaceKind,
        key: surfaceKey,
        moduleKey,
        ...identity,
      }),
    [moduleKey, openSurface, surfaceKey, surfaceKind],
  );

  /** Persists one or more form changes through the shared workspace store. */
  const setValues = useCallback(
    (updater: SetStateAction<T>) => {
      const currentDraft = useAdminWorkspaceStore.getState().drafts[draftKey];
      const currentValues = {
        ...initialValues,
        ...(currentDraft?.values as Partial<T> | undefined),
      };
      const currentBaseline = currentDraft?.baseline ??
        (initialValues as Record<string, unknown>);
      const nextValues =
        typeof updater === "function"
          ? (updater as (current: T) => T)(currentValues)
          : updater;
      saveDraft({
        key: draftKey,
        values: nextValues as Record<string, unknown>,
        baseline: currentBaseline,
        formVersion,
        updatedAt: Date.now(),
      });
    },
    [draftKey, formVersion, initialValues, saveDraft],
  );

  /** Starts an edit draft with an explicit record baseline. */
  const initialize = useCallback(
    (nextValues: T) => {
      saveDraft({
        key: draftKey,
        values: nextValues as Record<string, unknown>,
        baseline: nextValues as Record<string, unknown>,
        formVersion,
        updatedAt: Date.now(),
      });
    },
    [draftKey, formVersion, saveDraft],
  );

  /** Closes the surface and applies the configured draft cleanup policy. */
  const close = useCallback(async () => {
    if (closePolicy === "discard") {
      if (isDirty) {
        if (
          confirmOnDiscard &&
          !(await requestConfirmation({
            title: resolvedConfirmTitle,
            description: resolvedConfirmDescription,
            confirmLabel: resolvedConfirmConfirmLabel,
            cancelLabel: resolvedConfirmCancelLabel,
            tone: "danger",
          }))
        ) {
          return false;
        }
      }
      removeDraft(draftKey);
    }
    closeSurface();
    return true;
  }, [
    closePolicy,
    confirmOnDiscard,
    closeSurface,
    draftKey,
    isDirty,
    removeDraft,
    resolvedConfirmCancelLabel,
    resolvedConfirmConfirmLabel,
    resolvedConfirmDescription,
    resolvedConfirmTitle,
  ]);

  /** Completes a successful mutation and always removes its draft. */
  const complete = useCallback(() => {
    removeDraft(draftKey);
    closeSurface();
  }, [closeSurface, draftKey, removeDraft]);

  return {
    values,
    setValues,
    initialize,
    isOpen,
    mode: isOpen ? surface?.mode : undefined,
    resourceId: isOpen ? surface?.resourceId : undefined,
    isDirty,
    open,
    close,
    complete,
    draftKey,
  };
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => areValuesEqual(value, right[index]));
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return keys.length === Object.keys(rightRecord).length &&
    keys.every((key) => Object.hasOwn(rightRecord, key) && areValuesEqual(leftRecord[key], rightRecord[key]));
}
