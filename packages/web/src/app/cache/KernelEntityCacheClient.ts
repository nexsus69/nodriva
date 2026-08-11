import { getEntityByIdAction } from '../actions/entityActions';
import type { ClientEntity } from '../types/models';
import type { CacheKernel } from './CacheKernel';
import type { CacheWriteDiagnostic } from './DomainCacheClient';

/** Compatibility facade for one entity-type partition backed by CacheKernel. */
export class KernelEntityCacheClient {
  private readonly namespace: string;
  private readonly recentWrites: CacheWriteDiagnostic[] = [];

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
    void requireComplete;
    return this.get(id) === null;
  }

  public fetchIfMissing(id: string, requireComplete = false): Promise<ClientEntity | null> {
    void requireComplete;
    const current = this.get(id);
    if (current) return Promise.resolve(current);
    return getEntityByIdAction(id).then((entity) => {
      if (!entity) return null;
      this.inject(entity.id, entity as ClientEntity, false, 'fetch:detail');
      return this.get(entity.id);
    });
  }

  public inject(id: string, data: Partial<ClientEntity> & { id: string }, _isPartial = false, source = 'unknown'): void {
    void _isPartial;
    const accepted = this.kernel.upsertRecord(this.namespace, data as ClientEntity);
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
    this.recentWrites.length = 0;
    this.onChange();
  }

  public getRecentWrites(limit = 12): CacheWriteDiagnostic[] {
    return this.recentWrites.slice(-limit);
  }
}
