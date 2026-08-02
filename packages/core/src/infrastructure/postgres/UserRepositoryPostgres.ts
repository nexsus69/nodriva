import { UserRepository } from '../../application/ports/UserRepository.js';
import { User } from '../../domain/models/User.js';
import { UserListItemDto, UserDetailDto, UserRoleDto } from '../../application/dto/UserAdminDtos.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { PgExecutor } from './PgExecutor.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  is_super_admin: boolean;
  row_version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface UserListRow {
  id: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: UserRoleDto[] | null;
}

interface UserDetailRow {
  id: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRoleRow {
  id: string;
  roleKey: string;
  name: string;
}

export class UserRepositoryPostgres implements UserRepository {
  constructor(private readonly executor: PgExecutor) {}

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, is_active, is_super_admin, row_version, created_at, updated_at, deleted_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const res = await this.executor.query<UserRow>(query, [id]);
    const row = res.rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, is_active, is_super_admin, row_version, created_at, updated_at, deleted_at
      FROM users
      WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
    `;
    const res = await this.executor.query<UserRow>(query, [email.trim()]);
    const row = res.rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async listUsers(): Promise<UserListItemDto[]> {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.is_active AS "isActive",
        u.is_super_admin AS "isSuperAdmin",
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt",
        COALESCE(
          json_agg(
            json_build_object('id', r.id, 'roleKey', r.role_key, 'name', r.name)
          ) FILTER (WHERE r.id IS NOT NULL), '[]'
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
      WHERE u.deleted_at IS NULL
      GROUP BY u.id
      ORDER BY u.email ASC
    `;
    const res = await this.executor.query<UserListRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      email: r.email,
      isActive: Boolean(r.isActive),
      isSuperAdmin: Boolean(r.isSuperAdmin),
      roles: Array.isArray(r.roles) ? r.roles : [],
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  async getUserDetail(id: string): Promise<UserDetailDto | null> {
    const userQuery = `
      SELECT id, email, is_active AS "isActive", is_super_admin AS "isSuperAdmin", row_version AS "rowVersion", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const userRes = await this.executor.query<UserDetailRow>(userQuery, [id]);
    if (userRes.rows.length === 0) {
      return null;
    }
    const u = userRes.rows[0];
    if (!u) {
      return null;
    }

    const rolesQuery = `
      SELECT r.id, r.role_key AS "roleKey", r.name
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND r.deleted_at IS NULL
      ORDER BY r.name ASC
    `;
    const rolesRes = await this.executor.query<UserRoleRow>(rolesQuery, [id]);

    const allRoles = await this.listAllRoles();

    return {
      id: u.id,
      email: u.email,
      isActive: Boolean(u.isActive),
      isSuperAdmin: Boolean(u.isSuperAdmin),
      rowVersion: Number(u.rowVersion),
      roles: rolesRes.rows.map((r) => ({ id: r.id, roleKey: r.roleKey, name: r.name })),
      allAvailableRoles: allRoles,
      createdAt: new Date(u.createdAt).toISOString(),
      updatedAt: new Date(u.updatedAt).toISOString(),
    };
  }

  async listAllRoles(): Promise<UserRoleDto[]> {
    const query = `
      SELECT id, role_key AS "roleKey", name
      FROM roles
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `;
    const res = await this.executor.query<UserRoleRow>(query);
    return res.rows.map((r) => ({ id: r.id, roleKey: r.roleKey, name: r.name }));
  }

  async createUser(user: User, roleIds: string[] = []): Promise<void> {
    await this.executor.query(
      `INSERT INTO users (id, email, password_hash, is_active, is_super_admin, row_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user.id, user.email, user.passwordHash, user.isActive, user.isSuperAdmin, user.rowVersion, user.createdAt, user.updatedAt]
    );

    if (roleIds.length > 0) {
      await this.assignUserRoles(user.id, roleIds);
    }
  }

  async updateUser(user: User): Promise<void> {
    const previousRowVersion = user.rowVersion - 1;
    const query = `
      UPDATE users
      SET email = $1, password_hash = $2, is_active = $3, is_super_admin = $4, row_version = $5, updated_at = $6
      WHERE id = $7 AND row_version = $8 AND deleted_at IS NULL
    `;
    const res = await this.executor.query(query, [
      user.email,
      user.passwordHash,
      user.isActive,
      user.isSuperAdmin,
      user.rowVersion,
      user.updatedAt,
      user.id,
      previousRowVersion,
    ]);

    if (res.rowCount === 0) {
      const check = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM users WHERE id = $1',
        [user.id]
      );
      const actual = check.rows[0]?.row_version ?? 0;
      throw new RowVersionMismatchError(previousRowVersion, actual);
    }
  }

  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.executor.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

    for (const roleId of roleIds) {
      await this.executor.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleId]
      );
    }
  }

  private mapToDomain(row: UserRow): User {
    return new User(
      row.id,
      row.email,
      row.password_hash,
      row.is_active,
      row.is_super_admin,
      row.row_version,
      row.created_at,
      row.updated_at,
      row.deleted_at
    );
  }
}
