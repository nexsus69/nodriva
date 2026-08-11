import { listNodeTypesAction } from '../actions/nodeActions';
import { listEntityTypesAction } from '../actions/entityActions';
import type { EntityTypeMeta, NodeTypeMeta } from '../types/models';
import { CacheKernel, type CacheQuerySnapshot } from './CacheKernel';

export type MetadataKind = 'node' | 'entity';
type MetadataRecord = NodeTypeMeta | EntityTypeMeta;
type MetadataSubscriber = (records: readonly MetadataRecord[], error?: Error) => void;

const QUERY_KEYS: Record<MetadataKind, string> = {
  node: 'metadata:node-types',
  entity: 'metadata:entity-types',
};

const RECORD_NAMESPACES: Record<MetadataKind, string> = {
  node: 'node-type',
  entity: 'entity-type',
};

const TOKENS: Record<MetadataKind, string> = {
  node: 'node-types',
  entity: 'entity-types',
};

/** Adapter that exposes type metadata from the normalized CacheKernel. */
export class MetadataCacheClient {
  public constructor(private readonly kernel: CacheKernel) {}

  private queryKey(kind: MetadataKind): string {
    return QUERY_KEYS[kind];
  }

  private async load(kind: MetadataKind): Promise<readonly MetadataRecord[]> {
    const snapshot = await this.kernel.readQuery(
      this.queryKey(kind),
      async () => {
        const records = kind === 'node' ? await listNodeTypesAction() : await listEntityTypesAction();
        records.forEach((record) => this.kernel.upsertRecord(RECORD_NAMESPACES[kind], record));
        return {
          ids: records.map((record) => record.id),
          recordNamespace: RECORD_NAMESPACES[kind],
          dependencies: [TOKENS[kind]],
        };
      },
      { recordNamespace: RECORD_NAMESPACES[kind], dependencies: [TOKENS[kind]] },
    );
    return this.kernel.resolveQueryRecords<MetadataRecord>(snapshot);
  }

  public list(kind: 'node'): Promise<readonly NodeTypeMeta[]>;
  public list(kind: 'entity'): Promise<readonly EntityTypeMeta[]>;
  public list(kind: MetadataKind): Promise<readonly MetadataRecord[]> {
    return this.load(kind);
  }

  public subscribe(kind: MetadataKind, subscriber: MetadataSubscriber): () => void {
    const notify = (snapshot: CacheQuerySnapshot | null) => {
      if (snapshot) {
        subscriber(this.kernel.resolveQueryRecords<MetadataRecord>(snapshot));
        return;
      }
      void this.load(kind).then((records) => subscriber(records)).catch((error: unknown) => {
        subscriber([], error instanceof Error ? error : new Error(String(error)));
      });
    };
    const unsubscribe = this.kernel.subscribeQuery(this.queryKey(kind), notify);
    void this.load(kind).then((records) => subscriber(records)).catch((error: unknown) => {
      subscriber([], error instanceof Error ? error : new Error(String(error)));
    });
    return unsubscribe;
  }

  public invalidate(kind: MetadataKind): void {
    this.kernel.invalidateToken(TOKENS[kind]);
    void this.load(kind).catch(() => undefined);
  }

  /** Forces a fresh authorized read after focus, polling or reconnect recovery. */
  public async reconcile(kind: MetadataKind): Promise<void> {
    this.kernel.invalidateToken(TOKENS[kind]);
    await this.load(kind);
  }

  public async reconcileAll(): Promise<void> {
    await Promise.all([this.reconcile('node'), this.reconcile('entity')]);
  }
}
