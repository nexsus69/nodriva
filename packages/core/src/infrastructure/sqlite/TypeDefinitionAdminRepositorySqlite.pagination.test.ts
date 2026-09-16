import { describe, expect, it, vi } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { TypeDefinitionAdminRepositorySqlite } from './TypeDefinitionAdminRepositorySqlite.js';

describe('TypeDefinitionAdminRepositorySqlite paged catalogue', () => {
  it('returns only the requested searched page with a stable server order', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    for (let i = 0; i < 26; i += 1) database.run('INSERT INTO node_types(id,type_key,name,description,current_schema_version,is_active,is_system,row_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [`type-${i}`, `task_${i}`, `Task ${i}`, '', 1, 1, 0, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    const all = vi.spyOn(database, 'all');
    const page = await new TypeDefinitionAdminRepositorySqlite(database).listTypesPage('node', { page: 2, pageSize: 25, search: 'Task', sort: { key: 'name', direction: 'ascending' } });
    expect(page).toMatchObject({ total: 26, page: 2, pageCount: 2 });
    expect(page.items).toHaveLength(1);
    expect(all.mock.calls.at(-1)?.[0]).toContain('LIMIT ? OFFSET ?');
    expect(all.mock.calls.at(-1)?.[1]).toEqual(expect.arrayContaining([25, 25]));
    database.close();
  });
});
