import { describe, expect, it, vi } from 'vitest';
import { AttachmentCollectionStore } from './AttachmentCollectionStore';
import { receiveAttachmentCollection } from '../attachments/attachmentCollectionModel';

const firstTarget = { resourceType: 'node' as const, resourceId: 'node-1', fieldKey: 'documents', kind: 'file' as const };
const secondTarget = { ...firstTarget, fieldKey: 'images', kind: 'image' as const };

describe('AttachmentCollectionStore', () => {
  it('keeps one snapshot per collection and notifies only its subscribers', () => {
    const store = new AttachmentCollectionStore();
    const firstSubscriber = vi.fn();
    const secondSubscriber = vi.fn();
    store.subscribeCollection(firstTarget, firstSubscriber);
    store.subscribeCollection(secondTarget, secondSubscriber);
    const state = receiveAttachmentCollection([]);

    store.setCollection(firstTarget, state);

    expect(store.getCollection(firstTarget)).toBe(state);
    expect(firstSubscriber).toHaveBeenCalledOnce();
    expect(secondSubscriber).not.toHaveBeenCalled();
  });

  it('invalidates every collection of one resource without affecting another resource', () => {
    const store = new AttachmentCollectionStore();
    const changed = vi.fn();
    const untouched = vi.fn();
    store.subscribeInvalidation({ resourceType: 'node', resourceId: 'node-1' }, changed);
    store.subscribeInvalidation({ resourceType: 'node', resourceId: 'node-2' }, untouched);

    store.notifyResourceChanged({ resourceType: 'node', resourceId: 'node-1' });

    expect(changed).toHaveBeenCalledOnce();
    expect(untouched).not.toHaveBeenCalled();
  });

  it('notifies mounted collection views when the read model is reset', () => {
    const store = new AttachmentCollectionStore();
    const subscriber = vi.fn();
    store.subscribeCollection(firstTarget, subscriber);
    store.setCollection(firstTarget, receiveAttachmentCollection([]));

    store.clearReadModel();

    expect(store.getCollection(firstTarget).hasLoaded).toBe(false);
    expect(subscriber).toHaveBeenCalledTimes(2);
  });
});
