"use client";

/** Binds the reusable resource controller to React without moving lifecycle logic into screens. */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { AdminResourceAction, AdminResourceDefinition } from "./AdminResourceDefinition";
import { AdminResourceController } from "./AdminResourceController";
import { refreshAdminCollection } from "./refreshAdminCollection";
import { useAdminRealtimeCollectionRefresh } from "./useAdminRealtimeCollectionRefresh";
import { useUserMutation, type MutationExecutionOptions } from "@/app/mutations/useUserMutation";

export function useAdminResourceController<
  TRow extends { id: string },
  TDetail = TRow,
  TForm extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
  TId = string,
>(
  definition: AdminResourceDefinition<TRow, TDetail, TForm, TContext, TId>,
  context: TContext,
) {
  const controller = useMemo(
    () => new AdminResourceController(definition, context),
    [context, definition],
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const mutation = useUserMutation();

  /** Adapts the controller's reconciliation lifecycle to the sole user-facing outcome owner. */
  const executeAction = useCallback(async (
    action: AdminResourceAction<TRow, TContext>,
    row: TRow,
    options?: MutationExecutionOptions,
  ) => {
    const outcome = await mutation.execute(async () => {
      const succeeded = await controller.executeAction(action, row);
      if (succeeded) return;
      const error = controller.getSnapshot().error ?? { code: "INTERNAL_ERROR", message: "" };
      controller.clearError();
      throw error;
    }, undefined, options);
    return outcome.ok;
  }, [controller, mutation]);

  const create = useCallback(async (
    input: TForm,
    options?: MutationExecutionOptions,
  ): Promise<TDetail | null> => {
    const outcome = await mutation.execute(async () => {
      const detail = await controller.create(input);
      if (detail !== null) return detail;
      const error = controller.getSnapshot().error ?? { code: "INTERNAL_ERROR", message: "" };
      controller.clearError();
      throw error;
    }, undefined, options);
    return outcome.ok ? outcome.value : null;
  }, [controller, mutation]);

  const update = useCallback(async (
    id: TId,
    input: TForm,
    expectedRowVersion?: number,
    options?: MutationExecutionOptions,
  ): Promise<TDetail | null> => {
    const outcome = await mutation.execute(async () => {
      const detail = await controller.update(id, input, expectedRowVersion);
      if (detail !== null) return detail;
      const error = controller.getSnapshot().error ?? { code: "INTERNAL_ERROR", message: "" };
      controller.clearError();
      throw error;
    }, undefined, options);
    return outcome.ok ? outcome.value : null;
  }, [controller, mutation]);

  useEffect(() => {
    if (definition.list.mode === 'remote') return;
    void controller.loadList();
  }, [controller, definition.list.mode]);
  useAdminRealtimeCollectionRefresh(
    definition.list.mode === 'remote' ? undefined : definition.list.realtimeDependencies,
    controller.loadList,
  );

  return {
    ...snapshot,
    pending: snapshot.pending || mutation.pending,
    controller,
    create,
    update,
    executeAction,
    mutationFailure: mutation.failure,
    retryMutation: () => void mutation.retry(),
    reload: controller.loadList,
    refresh: () => refreshAdminCollection(controller.loadList),
  };
}
