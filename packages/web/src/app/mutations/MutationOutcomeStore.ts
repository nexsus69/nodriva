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

/** Stores the single application-owned success outcome for user mutations. */
export const useMutationOutcomeStore = create<MutationOutcomeState>((set) => ({
  success: null,
  publishSuccess: (messageKey) => set({ success: { id: ++nextOutcomeId, messageKey } }),
  dismissSuccess: () => set({ success: null }),
}));

/** Publishes a success outcome without coupling mutation owners to a presentation surface. */
export function publishMutationSuccess(messageKey = 'mutation.completed'): void {
  useMutationOutcomeStore.getState().publishSuccess(messageKey);
}
