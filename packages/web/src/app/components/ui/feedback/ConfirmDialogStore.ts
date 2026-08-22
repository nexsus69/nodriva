import { create } from "zustand";

/** Defines every visual and semantic parameter of a shared application confirmation dialog. */
export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "neutral" | "danger";
}

/** Represents the currently pending application confirmation request. */
export interface ConfirmDialogRequest extends ConfirmDialogOptions {
  requestId: number;
}

interface ConfirmDialogState {
  request: ConfirmDialogRequest | null;
  open: (options: ConfirmDialogOptions) => Promise<boolean>;
  resolve: (confirmed: boolean) => void;
}

let nextRequestId = 0;
let pendingResolver: ((confirmed: boolean) => void) | null = null;

/** Stores one non-persistent confirmation request for the application UI host. */
export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  request: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      pendingResolver?.(false);
      pendingResolver = resolve;
      set({ request: { ...options, requestId: ++nextRequestId } });
    }),
  resolve: (confirmed) => {
    pendingResolver?.(confirmed);
    pendingResolver = null;
    set({ request: null });
  },
}));

/** Opens the shared application confirmation dialog and resolves the user's decision. */
export function requestConfirmation(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  return useConfirmDialogStore.getState().open(options);
}
