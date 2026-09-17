/** Stores attachment collection snapshots and their targeted browser subscriptions. */
import type { ResourceKind } from '@dashboard/core';
import {
  INITIAL_ATTACHMENT_COLLECTION,
  type AttachmentCollectionState,
} from '../attachments/attachmentCollectionModel';

export interface AttachmentResourceTarget {
  resourceType: Extract<ResourceKind, 'node' | 'entity'>;
  resourceId: string;
}

export interface AttachmentCollectionTarget extends AttachmentResourceTarget {
  fieldKey: string;
  kind: 'file' | 'image';
}

/**
 * Holds local attachment collection projections. Loading, mutation transport,
 * and realtime delivery intentionally remain outside this store.
 */
export class AttachmentCollectionStore {
  private readonly collectionSubscribers = new Map<string, Set<() => void>>();
  private readonly invalidationSubscribers = new Map<string, Set<() => void>>();
  private readonly collections = new Map<string, AttachmentCollectionState>();

  public subscribeCollection(target: AttachmentCollectionTarget, subscriber: () => void): () => void {
    return this.subscribe(this.collectionKey(target), this.collectionSubscribers, subscriber);
  }

  public getCollection(target: AttachmentCollectionTarget): AttachmentCollectionState {
    return this.collections.get(this.collectionKey(target)) ?? INITIAL_ATTACHMENT_COLLECTION;
  }

  public setCollection(target: AttachmentCollectionTarget, state: AttachmentCollectionState): void {
    const key = this.collectionKey(target);
    this.collections.set(key, state);
    this.notify(this.collectionSubscribers.get(key));
  }

  /** Subscribes to authoritative changes that require each collection to reload. */
  public subscribeInvalidation(target: AttachmentResourceTarget, subscriber: () => void): () => void {
    return this.subscribe(this.resourceKey(target), this.invalidationSubscribers, subscriber);
  }

  public notifyResourceChanged(target: AttachmentResourceTarget): void {
    this.notify(this.invalidationSubscribers.get(this.resourceKey(target)));
  }

  /** Drops snapshots while allowing mounted views to observe the reset. */
  public clearReadModel(): void {
    this.collections.clear();
    this.collectionSubscribers.forEach((subscribers) => this.notify(subscribers));
  }

  /** Drops authenticated data. Existing UI subscriptions retain their prior lifecycle semantics. */
  public purgeSession(): void {
    this.collections.clear();
  }

  private subscribe(
    key: string,
    registry: Map<string, Set<() => void>>,
    subscriber: () => void,
  ): () => void {
    const subscribers = registry.get(key) ?? new Set();
    subscribers.add(subscriber);
    registry.set(key, subscribers);
    return () => {
      const current = registry.get(key);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) registry.delete(key);
    };
  }

  private notify(subscribers: ReadonlySet<() => void> | undefined): void {
    subscribers?.forEach((subscriber) => subscriber());
  }

  private collectionKey(target: AttachmentCollectionTarget): string {
    return `${this.resourceKey(target)}:${target.fieldKey}:${target.kind}`;
  }

  private resourceKey(target: AttachmentResourceTarget): string {
    return `${target.resourceType}:${target.resourceId}`;
  }
}
