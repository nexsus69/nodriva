"use client";

import { useCallback, useMemo } from "react";
import { useAdminWorkspaceStore } from "./AdminWorkspaceStore";

/** Converts persisted workspace data into a non-empty list of stable row IDs. */
export function normalizeAdminRepeatableRowIds(
  value: unknown,
  initialRowId: string,
): readonly string[] {
  if (!Array.isArray(value)) return [initialRowId];
  const rowIds = value.filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );
  return rowIds.length > 0 ? [...new Set(rowIds)] : [initialRowId];
}

/** Owns reload-safe row identity for any repeatable Admin Panel form section. */
export function useAdminRepeatableRows({
  moduleKey,
  stateKey,
  initialRowId = "1",
}: {
  moduleKey: string;
  stateKey: string;
  initialRowId?: string;
}) {
  const persistedValue = useAdminWorkspaceStore(
    (state) => state.moduleState[moduleKey]?.[stateKey],
  );
  const setModuleState = useAdminWorkspaceStore((state) => state.setModuleState);
  const rowIds = useMemo(
    () => normalizeAdminRepeatableRowIds(persistedValue, initialRowId),
    [initialRowId, persistedValue],
  );

  /** Persists a new stable row ID and returns it to the consuming form. */
  const add = useCallback(() => {
    const rowId = crypto.randomUUID();
    setModuleState(moduleKey, { [stateKey]: [...rowIds, rowId] });
    return rowId;
  }, [moduleKey, rowIds, setModuleState, stateKey]);

  /** Removes one row while preserving the required initial row. */
  const remove = useCallback((rowId: string) => {
    const next = rowIds.filter((candidate) => candidate !== rowId);
    setModuleState(moduleKey, {
      [stateKey]: next.length > 0 ? next : [initialRowId],
    });
  }, [initialRowId, moduleKey, rowIds, setModuleState, stateKey]);

  /** Resets the repeatable section after discard or successful submission. */
  const reset = useCallback(() => {
    setModuleState(moduleKey, { [stateKey]: [initialRowId] });
  }, [initialRowId, moduleKey, setModuleState, stateKey]);

  return { rowIds, add, remove, reset };
}
