import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { MetadataCacheClient } from './MetadataCacheClient';

const mocks = vi.hoisted(() => ({
  listNodeTypesAction: vi.fn(),
  listEntityTypesAction: vi.fn(),
}));

vi.mock('../actions/nodeActions', () => ({ listNodeTypesAction: mocks.listNodeTypesAction }));
vi.mock('../actions/entityActions', () => ({ listEntityTypesAction: mocks.listEntityTypesAction }));

describe('MetadataCacheClient', () => {
  let kernel: CacheKernel;
  let metadata: MetadataCacheClient;

  beforeEach(() => {
    vi.clearAllMocks();
    kernel = new CacheKernel();
    metadata = new MetadataCacheClient(kernel);
    mocks.listNodeTypesAction.mockResolvedValue([
      { id: 'node-type-1', typeKey: 'project', name: 'Project', description: '', currentSchemaVersion: 1 },
    ]);
    mocks.listEntityTypesAction.mockResolvedValue([
      { id: 'entity-type-1', typeKey: 'customer', name: 'Customer', description: '', storageTable: 'entity_customer', currentSchemaVersion: 1 },
    ]);
  });

  it('loads each metadata list once and resolves it from canonical records', async () => {
    const first = await metadata.list('entity');
    const second = await metadata.list('entity');

    expect(first).toEqual(second);
    expect(mocks.listEntityTypesAction).toHaveBeenCalledTimes(1);
    expect(kernel.getRecord('entity-type', 'entity-type-1')).toMatchObject({ typeKey: 'customer' });
  });

  it('reloads subscribers after metadata invalidation', async () => {
    const received: string[] = [];
    await metadata.list('node');
    const unsubscribe = metadata.subscribe('node', (records) => {
      received.push(records.map((record) => record.typeKey).join(','));
    });

    mocks.listNodeTypesAction.mockResolvedValue([
      { id: 'node-type-2', typeKey: 'portfolio', name: 'Portfolio', description: '', currentSchemaVersion: 1 },
    ]);
    metadata.invalidate('node');
    await vi.waitFor(() => expect(received.at(-1)).toBe('portfolio'));

    expect(mocks.listNodeTypesAction).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
