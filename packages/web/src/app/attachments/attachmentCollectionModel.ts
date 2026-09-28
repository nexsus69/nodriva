/** Models visible attachment collection transitions without duplicating server authority. */

import type { AttachmentItem } from './attachmentClient';

export interface AttachmentCollectionState {
  items: readonly AttachmentItem[];
  hasLoaded: boolean;
  error: string | null;
  pendingDeletionIds: ReadonlySet<string>;
}

export const INITIAL_ATTACHMENT_COLLECTION: AttachmentCollectionState = {
  items: [],
  hasLoaded: false,
  error: null,
  pendingDeletionIds: new Set(),
};

/** Starts a refresh without replacing an already usable collection. */
export function beginAttachmentRefresh(state: AttachmentCollectionState): AttachmentCollectionState {
  return state.error === null ? state : { ...state, error: null };
}

export function receiveAttachmentCollection(items: readonly AttachmentItem[]): AttachmentCollectionState {
  return { items, hasLoaded: true, error: null, pendingDeletionIds: new Set() };
}

/** Keeps previous rows available when an authorized reread fails. */
export function failAttachmentRefresh(state: AttachmentCollectionState, error: string): AttachmentCollectionState {
  return { ...state, hasLoaded: true, error };
}

export function beginAttachmentDeletion(state: AttachmentCollectionState, attachmentId: string): AttachmentCollectionState {
  const pendingDeletionIds = new Set(state.pendingDeletionIds);
  pendingDeletionIds.add(attachmentId);
  return { ...state, error: null, pendingDeletionIds };
}

/** Removes only the server-confirmed attachment, preserving every other row. */
export function completeAttachmentDeletion(state: AttachmentCollectionState, attachmentId: string): AttachmentCollectionState {
  const pendingDeletionIds = new Set(state.pendingDeletionIds);
  pendingDeletionIds.delete(attachmentId);
  return {
    ...state,
    items: state.items.filter((item) => item.id !== attachmentId),
    pendingDeletionIds,
  };
}

/** Clears a failed delete's pending marker; user feedback is owned by the shared mutation lifecycle. */
export function abortAttachmentDeletion(state: AttachmentCollectionState, attachmentId: string): AttachmentCollectionState {
  const pendingDeletionIds = new Set(state.pendingDeletionIds);
  pendingDeletionIds.delete(attachmentId);
  return { ...state, pendingDeletionIds };
}

export function failAttachmentDeletion(state: AttachmentCollectionState, attachmentId: string, error: string): AttachmentCollectionState {
  const pendingDeletionIds = new Set(state.pendingDeletionIds);
  pendingDeletionIds.delete(attachmentId);
  return { ...state, error, pendingDeletionIds };
}
