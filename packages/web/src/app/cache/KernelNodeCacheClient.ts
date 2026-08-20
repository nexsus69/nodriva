import type { ClientNode } from '../types/models';
import type { CacheWriteDiagnostic } from './DomainCacheClient';
import type { CacheKernel, CacheQuerySnapshot, RecordCompleteness, RecordSatisfaction } from './CacheKernel';
import { getNodeByIdAction, listChildrenAction } from '../actions/nodeActions';

type NodeListSubscriber = (nodes: readonly ClientNode[], error?: Error) => void;

/** Compatibility facade for node consumers backed by the normalized kernel. */
export class KernelNodeCacheClient {
  private readonly recentWrites: CacheWriteDiagnostic[] = [];
  private readonly pendingRecordFetches = new Map<string, Promise<ClientNode | null>>();

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly onChange: () => void,
  ) {}

  public get(id: string): ClientNode | null {
    return this.kernel.getRecord<ClientNode>('node', id);
  }

  public retain(id: string): void { void id; }

  public release(id: string): void { void id; }

  public needsFetch(id: string, requireComplete: boolean): boolean {
    return this.getSatisfaction(id, requireComplete ? 'full' : 'summary') !== 'satisfied';
  }

  public getSatisfaction(
    id: string,
    completeness: RecordCompleteness = 'summary',
  ): RecordSatisfaction {
    return this.kernel.getRecordSatisfaction('node', id, completeness);
  }

  public fetchIfMissing(id: string, requireComplete = false): Promise<ClientNode | null> {
    if (!this.needsFetch(id, requireComplete)) return Promise.resolve(this.get(id));
    const pending = this.pendingRecordFetches.get(id);
    if (pending) return pending;
    const requestEpoch = this.kernel.getEpoch();
    const request = getNodeByIdAction(id).then((node) => {
      if (!node) return null;
      if (this.kernel.getEpoch() !== requestEpoch) return null;
      this.inject(node.id, node, false, 'fetch:detail');
      return this.get(node.id);
    }).finally(() => {
      if (this.pendingRecordFetches.get(id) === request) this.pendingRecordFetches.delete(id);
    });
    this.pendingRecordFetches.set(id, request);
    return request;
  }

  private childrenQueryKey(parentId: string | null): string {
    return `nodes:children:${parentId ?? 'root'}`;
  }

  public listChildren(parentId: string | null): Promise<readonly ClientNode[]> {
    return this.kernel.readQuery(
      this.childrenQueryKey(parentId),
      async () => {
        const nodes = await listChildrenAction(parentId);
        nodes.forEach((node) => this.inject(node.id, node, false, 'query:children'));
        return {
          ids: nodes.map((node) => node.id),
          recordNamespace: 'node',
          dependencies: ['node-children'],
        };
      },
      { recordNamespace: 'node', dependencies: ['node-children'] },
    ).then((snapshot) => this.kernel.resolveQueryRecords<ClientNode>(snapshot));
  }

  public subscribeChildren(parentId: string | null, subscriber: NodeListSubscriber): () => void {
    const notify = (snapshot: CacheQuerySnapshot | null) => {
      if (snapshot) {
        subscriber(this.kernel.resolveQueryRecords<ClientNode>(snapshot));
        return;
      }
      void this.listChildren(parentId).then((nodes) => subscriber(nodes)).catch((error: unknown) => {
        subscriber([], error instanceof Error ? error : new Error(String(error)));
      });
    };
    const unsubscribe = this.kernel.subscribeQuery(this.childrenQueryKey(parentId), notify);
    void this.listChildren(parentId).then((nodes) => subscriber(nodes)).catch((error: unknown) => {
      subscriber([], error instanceof Error ? error : new Error(String(error)));
    });
    return unsubscribe;
  }

  public invalidateChildren(): void {
    this.kernel.invalidateToken('node-children');
    this.onChange();
  }

  public inject(id: string, data: Partial<ClientNode> & { id: string }, _isPartial = false, source = 'unknown'): void {
    const accepted = this.kernel.upsertRecord('node', data as ClientNode, {
      completeness: _isPartial ? 'summary' : 'full',
    });
    this.recentWrites.push({
      timestamp: Date.now(),
      id,
      source,
      accepted,
      incomingVersion: data.rowVersion,
      incomingName: data.name,
      resultingName: this.get(id)?.name,
    });
    if (this.recentWrites.length > 40) this.recentWrites.splice(0, this.recentWrites.length - 40);
    this.onChange();
  }

  public subscribe(id: string, callback: (data: ClientNode | null, error: Error | null) => void): () => void {
    return this.kernel.subscribeRecord('node', id, (record) => callback(record as ClientNode | null, null));
  }

  public remove(id: string): void {
    this.kernel.removeRecord('node', id);
    this.onChange();
  }

  public invalidate(id: string): void {
    this.kernel.invalidateRecord('node', id);
    this.onChange();
  }

  public purge(): void {
    this.kernel.purgeNamespace('node');
    this.pendingRecordFetches.clear();
    this.recentWrites.length = 0;
    this.onChange();
  }

  public getRecentWrites(limit = 12): CacheWriteDiagnostic[] {
    return this.recentWrites.slice(-limit);
  }
}
