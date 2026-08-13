import { describe, expect, it, vi } from 'vitest';
import { EntityTypeRepositoryPostgres } from './EntityTypeRepositoryPostgres.js';
import { TypeDefinitionReaderPostgres } from './TypeDefinitionReaderPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

function executorWithRows(...rows: Array<unknown[]>): PgExecutor {
  const query = vi.fn();
  for (const result of rows) query.mockResolvedValueOnce({ rows: result });
  return { query } as unknown as PgExecutor;
}

describe('PostgreSQL type visibility', () => {
  it('excludes inactive and tombstoned entity types from runtime lookup and lists', async () => {
    const executor = executorWithRows([], [], []);
    const repository = new EntityTypeRepositoryPostgres(executor);
    await repository.findByKey('asset');
    await repository.findById('asset-id');
    await repository.listAll();
    const queries = vi.mocked(executor.query).mock.calls.map(([sql]) => String(sql));
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query).toContain('deleted_at IS NULL');
      expect(query).toContain('is_active = TRUE');
    }
  });

  it('resolves runtime schemas only for active, non-tombstoned types', async () => {
    const executor = executorWithRows([]);
    const reader = new TypeDefinitionReaderPostgres(executor);
    await expect(reader.readDefinition('entity', 'asset')).resolves.toBeNull();
    expect(String(vi.mocked(executor.query).mock.calls[0]?.[0])).toContain('is_active = TRUE');
  });
});
