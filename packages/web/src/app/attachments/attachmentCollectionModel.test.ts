/** Verifies that attachment refresh and deletion preserve unaffected visible rows. */

import { describe, expect, it } from 'vitest';
import {
  abortAttachmentDeletion,
  beginAttachmentDeletion,
  beginAttachmentRefresh,
  completeAttachmentDeletion,
  failAttachmentDeletion,
  failAttachmentRefresh,
  INITIAL_ATTACHMENT_COLLECTION,
  receiveAttachmentCollection,
} from './attachmentCollectionModel';

const first = { id: 'attachment-1', resourceType: 'entity' as const, resourceId: 'entity-1', fieldKey: 'documents', kind: 'file' as const, fileName: 'first.pdf', mimeType: 'application/pdf', sizeBytes: 10 };
const second = { ...first, id: 'attachment-2', fileName: 'second.pdf' };

describe('attachment collection lifecycle', () => {
  it('keeps existing rows during refresh and after a refresh failure', () => {
    const ready = receiveAttachmentCollection([first, second]);
    const refreshing = beginAttachmentRefresh(ready);
    const failed = failAttachmentRefresh(refreshing, 'Servizio non disponibile');

    expect(refreshing.items).toEqual([first, second]);
    expect(failed.items).toEqual([first, second]);
    expect(failed.hasLoaded).toBe(true);
    expect(failed.error).toBe('Servizio non disponibile');
  });

  it('removes only the confirmed row and retains rows after a deletion failure', () => {
    const ready = receiveAttachmentCollection([first, second]);
    const deleting = beginAttachmentDeletion(ready, first.id);
    const deleted = completeAttachmentDeletion(deleting, first.id);
    const failed = failAttachmentDeletion(beginAttachmentDeletion(ready, first.id), first.id, 'Eliminazione non riuscita');

    expect(deleting.items).toEqual([first, second]);
    expect(deleting.pendingDeletionIds).toEqual(new Set([first.id]));
    expect(deleted.items).toEqual([second]);
    expect(failed.items).toEqual([first, second]);
    expect(failed.error).toBe('Eliminazione non riuscita');
    expect(INITIAL_ATTACHMENT_COLLECTION.hasLoaded).toBe(false);
  });

  it('clears a failed deletion marker without duplicating its error presentation', () => {
    const aborted = abortAttachmentDeletion(beginAttachmentDeletion(receiveAttachmentCollection([first, second]), first.id), first.id);

    expect(aborted.items).toEqual([first, second]);
    expect(aborted.pendingDeletionIds).toEqual(new Set());
    expect(aborted.error).toBeNull();
  });
});
