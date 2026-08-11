import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { KernelEntityCacheClient } from './KernelEntityCacheClient';

const getEntityByIdAction = vi.hoisted(() => vi.fn());

vi.mock('../actions/entityActions', () => ({ getEntityByIdAction }));

const entity = (id: string, name: string, rowVersion = 1) => ({
  id,
  entityTypeId: 'customer',
  parentNodeId: 'node-1',
  name,
  description: '',
  rowVersion,
  payload: {},
});

describe('KernelEntityCacheClient', () => {
  let client: KernelEntityCacheClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new KernelEntityCacheClient(new CacheKernel(), 'customer', vi.fn());
  });

  it('keeps entity records isolated by entity type namespace', () => {
    client.inject('entity-1', entity('entity-1', 'Customer'));

    expect(client.get('entity-1')).toMatchObject({ name: 'Customer' });
    expect(client.getRecentWrites(1)[0]).toMatchObject({ accepted: true, id: 'entity-1' });
  });

  it('hydrates a missing entity through the server action', async () => {
    getEntityByIdAction.mockResolvedValue(entity('entity-2', 'Analytics'));

    await expect(client.fetchIfMissing('entity-2', true)).resolves.toMatchObject({ name: 'Analytics' });
    expect(getEntityByIdAction).toHaveBeenCalledWith('entity-2');
    expect(client.get('entity-2')?.name).toBe('Analytics');
  });
});
