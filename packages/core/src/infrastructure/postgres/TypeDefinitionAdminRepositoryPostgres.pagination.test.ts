import { describe, expect, it, vi } from 'vitest';
import { TypeDefinitionAdminRepositoryPostgres } from './TypeDefinitionAdminRepositoryPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

describe('TypeDefinitionAdminRepositoryPostgres paged catalogue', () => {
  it('bounds a searched page and clamps a page beyond the result set', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 26 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'type-26', typeKey: 'task', name: 'Task', description: '', storageTable: null, currentSchemaVersion: 2, isActive: true, isSystem: false, rowVersion: 1, fieldCount: 3, updatedAt: new Date('2026-01-01T00:00:00.000Z') }] }) };
    const page = await new TypeDefinitionAdminRepositoryPostgres(executor as unknown as PgExecutor)
      .listTypesPage('node', { page: 99, pageSize: 25, search: '50%_task', sort: { key: 'fields', direction: 'descending' } });
    expect(page).toMatchObject({ total: 26, page: 2, pageCount: 2, items: [{ id: 'type-26', kind: 'node' }] });
    expect(executor.query.mock.calls[1]?.[0]).toContain('ORDER BY field_count DESC');
    expect(executor.query.mock.calls[1]?.[0]).toContain('LIMIT $2 OFFSET $3');
    expect(executor.query.mock.calls[1]?.[1]).toEqual(['%50\\%\\_task%', 25, 25]);
  });
});
