import { describe, expect, it } from 'vitest';
import { User } from '../../domain/models/User.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { UserRepositorySqlite } from './UserRepositorySqlite.js';

describe('UserRepositorySqlite', () => {
  it('supports user lookup, roles and optimistic updates', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    database.run('INSERT INTO roles (id,role_key,name) VALUES (?,?,?)', ['role', 'admin', 'Admin']);
    const repository = new UserRepositorySqlite(database);
    const user = User.create('user', 'Test@Example.com', 'hash', true);
    await repository.createUser(user, ['role']);
    await expect(repository.findByEmail('test@example.com')).resolves.toMatchObject({ email: 'test@example.com', isSuperAdmin: true });
    await expect(repository.getUserDetail('user')).resolves.toMatchObject({ roles: [{ id: 'role', roleKey: 'admin' }] });
    await repository.updateUser(user.changePassword('new-hash'));
    await expect(repository.findById('user')).resolves.toMatchObject({ passwordHash: 'new-hash', rowVersion: 2 });
    database.close();
  });

  it('returns distinct bounded pages for a manageable superadmin catalogue', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const repository = new UserRepositorySqlite(database);
    for (const [id, email, superAdmin] of [['actor', 'admin@example.com', true], ['a', 'alpha@example.com', false], ['b', 'bravo@example.com', false]] as const) {
      await repository.createUser(User.create(id, email, 'hash', superAdmin));
    }
    await expect(repository.listUsersManageablePage('actor', { page: 1, pageSize: 2, sort: { key: 'email', direction: 'ascending' } }))
      .resolves.toMatchObject({ total: 3, page: 1, pageCount: 2, items: [{ email: 'admin@example.com' }, { email: 'alpha@example.com' }] });
    await expect(repository.listUsersManageablePage('actor', { page: 2, pageSize: 2, search: 'example', sort: { key: 'email', direction: 'ascending' } }))
      .resolves.toMatchObject({ total: 3, page: 2, pageCount: 2, items: [{ email: 'bravo@example.com' }] });
    database.close();
  });
});
