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
});
