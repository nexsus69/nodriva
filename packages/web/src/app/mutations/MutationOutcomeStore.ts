import { create } from 'zustand';

/** Identifies one localized success outcome that remains visible across client route changes. */
export interface MutationSuccessOutcome {
  id: number;
  messageKey: string;
}

interface MutationOutcomeState {
  success: MutationSuccessOutcome | null;
  publishSuccess: (messageKey: string) => void;
  dismissSuccess: () => void;
}

let nextOutcomeId = 0;
let autoDismissTimer: ReturnType<typeof setTimeout> | undefined;

/** Keeps success feedback long enough to be read without requiring a manual dismissal. */
export const MUTATION_SUCCESS_AUTO_DISMISS_MS = 5_000;

function clearAutoDismissTimer(): void {
  if (autoDismissTimer === undefined) return;
  clearTimeout(autoDismissTimer);
  autoDismissTimer = undefined;
}

/** Stores the single application-owned success outcome for user mutations. */
export const useMutationOutcomeStore = create<MutationOutcomeState>((set) => ({
  success: null,
  publishSuccess: (messageKey) => set({ success: { id: ++nextOutcomeId, messageKey } }),
  dismissSuccess: () => {
    clearAutoDismissTimer();
    set({ success: null });
  },
}));

/** Publishes a success outcome without coupling mutation owners to a presentation surface. */
export function publishMutationSuccess(messageKey = 'mutation.completed'): void {
  clearAutoDismissTimer();
  useMutationOutcomeStore.getState().publishSuccess(messageKey);
  autoDismissTimer = setTimeout(
    () => useMutationOutcomeStore.getState().dismissSuccess(),
    MUTATION_SUCCESS_AUTO_DISMISS_MS,
  );
}
