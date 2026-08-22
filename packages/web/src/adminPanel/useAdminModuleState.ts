"use client";

/** Provides one typed, persisted state boundary for every Admin module surface. */
import { useCallback, useMemo } from "react";
import { useAdminWorkspaceStore } from "./AdminWorkspaceStore";

export function useAdminModuleState<T extends Record<string, unknown>>(
  moduleKey: string,
  defaults: T,
): [T, (values: Partial<T>) => void, () => void] {
  const persisted = useAdminWorkspaceStore(
    (state) => state.moduleState[moduleKey],
  );
  const setModuleState = useAdminWorkspaceStore(
    (state) => state.setModuleState,
  );
  const clearModuleState = useAdminWorkspaceStore(
    (state) => state.clearModuleState,
  );
  const value = useMemo(
    () => ({ ...defaults, ...(persisted ?? {}) }) as T,
    [defaults, persisted],
  );
  const update = useCallback(
    (values: Partial<T>) => setModuleState(moduleKey, values),
    [moduleKey, setModuleState],
  );
  const reset = useCallback(
    () => clearModuleState(moduleKey),
    [clearModuleState, moduleKey],
  );
  return [value, update, reset];
}
