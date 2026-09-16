import type { UserRepository } from '../../application/ports/UserRepository.js';
import type { UserListItemDto, UserListPageDto, UserListPageParams, UserDetailDto, UserRoleDto } from '../../application/dto/UserAdminDtos.js';
import { User } from '../../domain/models/User.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import { hasSqlitePermissionCoverage } from './SqlitePermissionCoverage.js';

interface UserRow { id: string; email: string; password_hash: string; is_active: number; is_super_admin: number; row_version: number; created_at: string; updated_at: string; deleted_at: string | null; }

export class UserRepositorySqlite implements UserRepository {
  constructor(private readonly database: SqliteDatabase) {}
  async findById(id: string): Promise<User | null> { const row = this.database.get<UserRow>('SELECT * FROM users WHERE id=? AND deleted_at IS NULL', [id]); return row ? this.map(row) : null; }
  async findByEmail(email: string): Promise<User | null> { const row = this.database.get<UserRow>('SELECT * FROM users WHERE lower(email)=lower(?) AND deleted_at IS NULL', [email.trim()]); return row ? this.map(row) : null; }
  async listUsers(): Promise<UserListItemDto[]> { return this.list(); }
  /** Lists only identities whose complete allow-scope is inside the actor boundary. */
  async listUsersManageableBy(actorUserId: string): Promise<UserListItemDto[]> {
    const actor = this.database.get<{ is_super_admin: number }>(
      'SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL',
      [actorUserId],
    );
    if (actor?.is_super_admin === 1) return this.list();
    const users = await this.list();
    const manageable: UserListItemDto[] = [];
    for (const user of users) {
      if (await this.isUserManageableBy(actorUserId, user.id)) manageable.push(user);
    }
    return manageable;
  }

  /**
   * Bounded SQLite implementation of the same delegation policy as PostgreSQL.
   * Candidates are read in small ordered batches; no complete user catalogue is
   * materialized before filtering its delegated scopes.
   */
  async listUsersManageablePage(actorUserId: string, params: UserListPageParams): Promise<UserListPageDto> {
    const pageSize = Math.min(100, Math.max(1, params.pageSize));
    const actor = this.database.get<{ is_super_admin: number }>('SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL', [actorUserId]);
    const { where, values, order } = this.pageQuery(params, actor?.is_super_admin === 1);
    if (actor?.is_super_admin === 1) {
      const total = Number(this.database.get<{ total: number }>(`SELECT COUNT(*) AS total FROM users u WHERE ${where}`, values)?.total ?? 0);
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(Math.max(1, params.page), pageCount);
      const rows = this.database.all<UserRow>(`SELECT u.* FROM users u WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
      return { items: await this.listRows(rows), total, page, pageCount };
    }
    if (!actor) return { items: [], total: 0, page: 1, pageCount: 1 };
    const candidates = async function* (repository: UserRepositorySqlite): AsyncGenerator<UserRow> {
      const batchSize = 100;
      for (let offset = 0; ; offset += batchSize) {
        const rows = repository.database.all<UserRow>(`SELECT u.* FROM users u WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...values, batchSize, offset]);
        if (rows.length === 0) return;
        for (const row of rows) yield row;
        if (rows.length < batchSize) return;
      }
    };
    let total = 0;
    let page = Math.max(1, params.page);
    const start = (page - 1) * pageSize;
    const rows: UserRow[] = [];
    for await (const candidate of candidates(this)) {
      if (!await this.isUserManageableBy(actorUserId, candidate.id)) continue;
      if (total >= start && rows.length < pageSize) rows.push(candidate);
      total += 1;
    }
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pageCount);
    // A concurrent deletion can make the requested page empty: rerun against
    // its normalized page rather than returning a misleading blank result.
    if (rows.length === 0 && total > 0 && page !== params.page) return this.listUsersManageablePage(actorUserId, { ...params, page });
    return { items: await this.listRows(rows), total, page, pageCount };
  }

  /** Returns a detail only when every target allow-scope is delegable by the actor. */
  async getUserDetailManageableBy(actorUserId: string, userId: string): Promise<UserDetailDto | null> {
    if (!await this.isUserManageableBy(actorUserId, userId)) return null;
    return this.getUserDetail(userId);
  }

  /** Checks the same delegated-boundary rule used by the PostgreSQL adapter. */
  async isUserManageableBy(actorUserId: string, userId: string): Promise<boolean> {
    const actor = this.database.get<{ is_super_admin: number }>(
      'SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL',
      [actorUserId],
    );
    if (actor?.is_super_admin === 1) return Boolean(this.database.get('SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL', [userId]));
    if (!this.database.get('SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL', [userId])) return false;
    const hasGlobalRole = this.database.get(
      "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.role_key NOT IN ('default_reader','scoped_reader') AND r.deleted_at IS NULL",
      [userId],
    );
    if (hasGlobalRole) return false;
    const assignments = this.database.all<{ node_id: string; propagation: 'self' | 'subtree' }>(
      "SELECT node_id, propagation FROM node_scope_assignments WHERE user_id=? AND assignment_effect='allow'",
      [userId],
    );
    return assignments.length > 0 && assignments.every((assignment) => this.actorCanDelegateScope(actorUserId, assignment.node_id, assignment.propagation));
  }
  async getUserDetail(id: string): Promise<UserDetailDto | null> { const user = await this.findById(id); if (!user) return null; const roles = await this.rolesFor(id); return { id: user.id, email: user.email, isActive: user.isActive, isSuperAdmin: user.isSuperAdmin, rowVersion: user.rowVersion, roles, allAvailableRoles: await this.listAllRoles(), createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() }; }
  async listAllRoles(): Promise<UserRoleDto[]> { return this.database.all<UserRoleDto>('SELECT id,role_key AS roleKey,name FROM roles WHERE deleted_at IS NULL ORDER BY name'); }
  async createUser(user: User, roleIds: string[] = []): Promise<void> {
    this.database.run(
      'INSERT INTO users (id,email,password_hash,is_active,is_super_admin,row_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [user.id, user.email, user.passwordHash, user.isActive ? 1 : 0, user.isSuperAdmin ? 1 : 0, user.rowVersion, user.createdAt.toISOString(), user.updatedAt.toISOString()],
    );
    for (const roleId of roleIds) this.database.run('INSERT OR IGNORE INTO user_roles (user_id,role_id) VALUES (?,?)', [user.id, roleId]);
  }
  async updateUser(user: User): Promise<void> { const result = this.database.run('UPDATE users SET email=?,password_hash=?,is_active=?,is_super_admin=?,row_version=?,updated_at=? WHERE id=? AND row_version=? AND deleted_at IS NULL', [user.email, user.passwordHash, user.isActive ? 1 : 0, user.isSuperAdmin ? 1 : 0, user.rowVersion, user.updatedAt.toISOString(), user.id, user.rowVersion - 1]); if (!result.changes) { const row = this.database.get<{ row_version: number }>('SELECT row_version FROM users WHERE id=? AND deleted_at IS NULL', [user.id]); throw new RowVersionMismatchError(user.rowVersion - 1, row?.row_version ?? 0); } }
  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> { this.database.run('DELETE FROM user_roles WHERE user_id=?', [userId]); for (const roleId of roleIds) this.database.run('INSERT INTO user_roles (user_id,role_id) VALUES (?,?)', [userId, roleId]); }
  /** Resolves both catalog roles and roles attached to node scopes for display. */
  private async rolesFor(userId: string): Promise<UserRoleDto[]> {
    return this.database.all<UserRoleDto>(
      `SELECT DISTINCT r.id,r.role_key AS roleKey,r.name
       FROM roles r
       LEFT JOIN user_roles ur ON ur.role_id=r.id AND ur.user_id=?
       LEFT JOIN node_scope_assignments sa ON sa.role_id=r.id AND sa.user_id=? AND sa.assignment_effect='allow'
       WHERE r.deleted_at IS NULL AND (ur.user_id IS NOT NULL OR sa.user_id IS NOT NULL)
       ORDER BY r.name`,
      [userId, userId],
    );
  }
  private async list(): Promise<UserListItemDto[]> { return this.listRows(this.database.all<UserRow>('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY email')); }
  private async listRows(rows: readonly UserRow[]): Promise<UserListItemDto[]> { const result: UserListItemDto[] = []; for (const row of rows) result.push({ id: row.id, email: row.email, isActive: row.is_active === 1, isSuperAdmin: row.is_super_admin === 1, roles: await this.rolesFor(row.id), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() }); return result; }

  private pageQuery(params: UserListPageParams, superAdmin: boolean): { where: string; values: unknown[]; order: string } {
    const values: unknown[] = [];
    const where = ['u.deleted_at IS NULL'];
    if (!superAdmin) {
      where.push('u.is_super_admin=0', "EXISTS (SELECT 1 FROM node_scope_assignments target WHERE target.user_id=u.id AND target.assignment_effect='allow')", "NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.deleted_at IS NULL AND r.role_key NOT IN ('default_reader','scoped_reader'))");
    }
    if (params.search?.trim()) {
      where.push("u.email LIKE ? ESCAPE '\\'");
      values.push(`%${params.search.trim().replace(/[\\%_]/g, '\\$&')}%`);
    }
    const field = params.sort?.key === 'status' ? 'u.is_active' : params.sort?.key === 'createdAt' ? 'u.created_at' : 'u.email';
    const direction = params.sort?.direction === 'descending' ? 'DESC' : 'ASC';
    return { where: where.join(' AND '), values, order: `${field} ${direction}, u.email ASC, u.id ASC` };
  }

  /** Verifies that the actor can delegate scope.assign over a target assignment. */
  private actorCanDelegateScope(actorUserId: string, nodeId: string, propagation: 'self' | 'subtree'): boolean {
    return hasSqlitePermissionCoverage(this.database, actorUserId, 'scope.assign', nodeId, propagation);
  }
  private map(row: UserRow): User { return new User(row.id, row.email, row.password_hash, row.is_active === 1, row.is_super_admin === 1, row.row_version, new Date(row.created_at), new Date(row.updated_at), row.deleted_at ? new Date(row.deleted_at) : null); }
}
