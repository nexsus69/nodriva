import { useCallback, useMemo } from "react";
import type { SetStateAction } from "react";
import {
  useAdminWorkspaceStore,
  type AdminSurfaceState,
} from "./AdminWorkspaceStore";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";

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
  confirmTitle = "Discard unsaved changes?",
  confirmDescription = "Your changes will be removed from this form.",
  confirmConfirmLabel = "Discard changes",
  confirmCancelLabel = "Keep editing",
}: AdminFormSurfaceOptions<T>) {
  const draft = useAdminWorkspaceStore((state) => state.drafts[draftKey]);
  const surface = useAdminWorkspaceStore((state) => state.surface);
  const openSurface = useAdminWorkspaceStore((state) => state.openSurface);
  const closeSurface = useAdminWorkspaceStore((state) => state.closeSurface);
  const saveDraft = useAdminWorkspaceStore((state) => state.saveDraft);
  const removeDraft = useAdminWorkspaceStore((state) => state.removeDraft);
  const values = useMemo(
    () => ({ ...initialValues, ...(draft?.values as Partial<T> | undefined) }),
    [draft?.values, initialValues],
  );
  const isOpen = surface?.moduleKey === moduleKey && surface.key === surfaceKey;
  const isDirty = draft !== undefined;

  /** Opens the configured modal or drawer without changing its draft. */
  const open = useCallback(
    () => openSurface({ kind: surfaceKind, key: surfaceKey, moduleKey }),
    [moduleKey, openSurface, surfaceKey, surfaceKind],
  );

  /** Persists one or more form changes through the shared workspace store. */
  const setValues = useCallback(
    (updater: SetStateAction<T>) => {
      const nextValues =
        typeof updater === "function"
          ? (updater as (current: T) => T)(values)
          : updater;
      saveDraft({
        key: draftKey,
        values: nextValues as Record<string, unknown>,
        formVersion,
        updatedAt: Date.now(),
      });
    },
    [draftKey, formVersion, saveDraft, values],
  );

  /** Closes the surface and applies the configured draft cleanup policy. */
  const close = useCallback(async () => {
    if (closePolicy === "discard" && isDirty) {
      if (
        confirmOnDiscard &&
        !(await requestConfirmation({
          title: confirmTitle,
          description: confirmDescription,
          confirmLabel: confirmConfirmLabel,
          cancelLabel: confirmCancelLabel,
          tone: "danger",
        }))
      )
        return false;
      removeDraft(draftKey);
    }
    closeSurface();
    return true;
  }, [
    closePolicy,
    confirmCancelLabel,
    confirmConfirmLabel,
    confirmDescription,
    confirmOnDiscard,
    confirmTitle,
    closeSurface,
    draftKey,
    isDirty,
    removeDraft,
  ]);

  /** Completes a successful mutation and always removes its draft. */
  const complete = useCallback(() => {
    removeDraft(draftKey);
    closeSurface();
  }, [closeSurface, draftKey, removeDraft]);

  return {
    values,
    setValues,
    isOpen,
    isDirty,
    open,
    close,
    complete,
    draftKey,
  };
}
