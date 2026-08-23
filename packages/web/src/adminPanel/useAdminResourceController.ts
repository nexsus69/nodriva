"use client";

/** Binds the reusable resource controller to React without moving lifecycle logic into screens. */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { AdminResourceDefinition } from "./AdminResourceDefinition";
import { AdminResourceController } from "./AdminResourceController";

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

  useEffect(() => {
    void controller.loadList();
  }, [controller]);

  return {
    ...snapshot,
    controller,
    reload: controller.loadList,
  };
}
