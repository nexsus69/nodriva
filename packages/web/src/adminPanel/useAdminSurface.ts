"use client";

/** Controls the persistent state and transitions of any configured Admin surface. */
import { useCallback } from "react";
import { useAdminModuleState } from "./useAdminModuleState";
import type { AdminSurfaceDefinition } from "./AdminSurfaceDefinition";

export function useAdminSurface<TState extends Record<string, unknown>>(
  definition: AdminSurfaceDefinition<TState>,
) {
  const [state, update, reset] = useAdminModuleState(
    `${definition.moduleKey}.${definition.key}`,
    definition.initialState,
  );
  const setTab = useCallback(
    (tab: string) => {
      if (definition.tabs.includes(tab))
        update({ activeTab: tab } as unknown as Partial<TState>);
    },
    [definition.tabs, update],
  );
  const openDialog = useCallback(
    () => update({ isDialogOpen: true } as unknown as Partial<TState>),
    [update],
  );
  const closeDialog = useCallback(
    () => update({ isDialogOpen: false } as unknown as Partial<TState>),
    [update],
  );
  return { ...state, setTab, openDialog, closeDialog, update, reset };
}
