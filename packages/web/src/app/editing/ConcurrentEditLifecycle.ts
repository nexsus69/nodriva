/**
 * Owns the concurrency lifecycle shared by editable resources.
 *
 * Domain controllers keep their own fields, attachments and navigation, while
 * this model owns the baseline revision and the transition to a stale draft.
 */
export interface ConcurrentEditState {
  baselineRowVersion: number | null;
  stale: boolean;
}

export const IDLE_CONCURRENT_EDIT: ConcurrentEditState = {
  baselineRowVersion: null,
  stale: false,
};

export function beginConcurrentEdit(rowVersion: number): ConcurrentEditState {
  return { baselineRowVersion: rowVersion, stale: false };
}

export function abandonConcurrentEdit(): ConcurrentEditState {
  return IDLE_CONCURRENT_EDIT;
}

/** Accepts a server-confirmed write or explicit reload as the new edit baseline. */
export function acceptConcurrentEditVersion(rowVersion: number): ConcurrentEditState {
  return { baselineRowVersion: rowVersion, stale: false };
}

/**
 * Detects a concurrent update delivered through cache/realtime. Local pending
 * mutations are ignored until their authoritative response is reconciled.
 */
export function reconcileConcurrentEdit(
  state: ConcurrentEditState,
  input: {
    ownsLock: boolean;
    currentRowVersion: number | undefined;
    mutationPending: boolean;
    currentVersionIsLocal: boolean;
  },
): ConcurrentEditState {
  if (
    state.stale
    || !input.ownsLock
    || state.baselineRowVersion === null
    || input.currentRowVersion === undefined
    || input.mutationPending
    || input.currentVersionIsLocal
    || input.currentRowVersion === state.baselineRowVersion
  ) return state;
  return { ...state, stale: true };
}

export function canSubmitConcurrentEdit(
  state: ConcurrentEditState,
  currentRowVersion: number | undefined,
): boolean {
  return !state.stale
    && state.baselineRowVersion !== null
    && currentRowVersion !== undefined
    && state.baselineRowVersion === currentRowVersion;
}
