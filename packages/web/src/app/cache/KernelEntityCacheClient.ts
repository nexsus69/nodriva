import { getEntityByIdAction } from '../actions/entityActions';
import type { ClientEntity } from '../types/models';
import type { CacheKernel, RecordCompleteness, RecordSatisfaction } from './CacheKernel';
import type { CacheWriteDiagnostic } from './CacheTypes';

/** Compatibility facade for one entity-type partition backed by CacheKernel. */
export class KernelEntityCacheClient {
  private readonly namespace: string;
  private readonly recentWrites: CacheWriteDiagnostic[] = [];
  private readonly pendingRecordFetches = new Map<string, Promise<ClientEntity | null>>();

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly entityTypeKey: string,
    private readonly onChange: () => void,
  ) {
    this.namespace = `entity:${entityTypeKey}`;
  }

  public get(id: string): ClientEntity | null {
    return this.kernel.getRecord<ClientEntity>(this.namespace, id);
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
    return this.kernel.getRecordSatisfaction(this.namespace, id, completeness);
  }

  public fetchIfMissing(id: string, requireComplete = false): Promise<ClientEntity | null> {
    if (!this.needsFetch(id, requireComplete)) return Promise.resolve(this.get(id));
    const pending = this.pendingRecordFetches.get(id);
    if (pending) return pending;
    const requestEpoch = this.kernel.getEpoch();
    const request = getEntityByIdAction(id).then((entity) => {
      if (!entity) return null;
      if (this.kernel.getEpoch() !== requestEpoch) return null;
      this.inject(entity.id, entity as ClientEntity, false, 'fetch:detail');
      return this.get(entity.id);
    }).finally(() => {
      if (this.pendingRecordFetches.get(id) === request) this.pendingRecordFetches.delete(id);
    });
    this.pendingRecordFetches.set(id, request);
    return request;
  }

  public inject(id: string, data: Partial<ClientEntity> & { id: string }, _isPartial = false, source = 'unknown'): void {
    const accepted = this.kernel.upsertRecord(this.namespace, data as ClientEntity, {
      completeness: _isPartial ? 'summary' : 'full',
      certified: source !== 'unknown' && !source.startsWith('realtime:'),
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

  public subscribe(id: string, callback: (data: ClientEntity | null, error: Error | null) => void): () => void {
    return this.kernel.subscribeRecord(this.namespace, id, (record) => callback(record as ClientEntity | null, null));
  }

  public remove(id: string): void {
    this.kernel.removeRecord(this.namespace, id);
    this.onChange();
  }

  public invalidate(id: string): void {
    this.kernel.invalidateRecord(this.namespace, id);
    this.onChange();
  }

  public purge(): void {
    this.kernel.purgeNamespace(this.namespace);
    this.pendingRecordFetches.clear();
    this.recentWrites.length = 0;
    this.onChange();
  }

  public getRecentWrites(limit = 12): CacheWriteDiagnostic[] {
    return this.recentWrites.slice(-limit);
  }
}
