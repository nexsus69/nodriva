/** Verifies deterministic SQL lock ordering for relationship target batches. */
import { describe, expect, it, vi } from 'vitest';
import { ResourceRelationshipRepositoryPostgres } from './ResourceRelationshipRepositoryPostgres.js';

describe('ResourceRelationshipRepositoryPostgres lock ordering', () => {
  it('deduplicates and orders typed targets before acquiring locks', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const repository = new ResourceRelationshipRepositoryPostgres(executor as never);
    await repository.lockActiveTargets([
      { domain: 'node', resourceId: 'b' }, { domain: 'entity', resourceId: 'z' },
      { domain: 'node', resourceId: 'a' }, { domain: 'entity', resourceId: 'z' },
    ]);
    expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining('ORDER BY id FOR UPDATE'), [['z']]);
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ORDER BY id FOR UPDATE'), [['a', 'b']]);
  });

  it('orders target verification before FOR KEY SHARE', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ id: 'a' }, { id: 'b' }] }) };
    const repository = new ResourceRelationshipRepositoryPostgres(executor as never);
    await repository.assertTargetsActive('entity', ['b', 'a', 'b']);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY id FOR KEY SHARE'), [['a', 'b']]);
  });
});
