/** Implements SQLite security administration with shared scope-coverage semantics. */
import { Role } from '../../domain/models/Role.js';
import type { SecurityRepository } from '../../application/ports/SecurityRepository.js';
import type { PermissionDto, RealtimeScopeAssignmentDto, RevokedDelegatedScopeAssignmentDto, RoleDetailDto, RoleListItemDto, ScopeAssignmentDto } from '../../application/dto/SecurityAdminDtos.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { SecurityAdminValidationError } from '../../domain/errors/SecurityAdminErrors.js';
import { createRealtimeChannelPolicy, type RealtimeChannelPolicy, type RealtimeChannelRule, type RealtimePermissionKey } from '../../application/realtime/RealtimeChannelPolicy.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import { hasSqlitePermissionCoverage } from './SqlitePermissionCoverage.js';

type RoleRow = { id: string; role_key: string; name: string; description: string | null; is_system: number; row_version: number; created_at: string; updated_at: string; deleted_at: string | null };
type RoleListRow = RoleRow & { permissionCount: number };
type ActorRow = { is_super_admin: number };
type ScopeAssignmentOwnerRow = { user_id: string };
type ScopeAssignmentRow = Omit<ScopeAssignmentDto, 'assignedAt'> & { assignedAt: string };
type RealtimeScopeAssignmentRow = RealtimeScopeAssignmentDto;
type RealtimePolicyUserRow = { id: string; isSuperAdmin: number };
type RealtimePolicyRuleRow = RealtimeChannelRule;
type AssignmentCoverageRow = { id: string; user_id: string; node_id: string; role_id: string; propagation: 'self' | 'subtree'; assigned_by: string | null };
type ScopeTargetValidationRow = { activeUser: number; activeNode: number; activeRole: number; conflictingAssignment: number };

const isSqliteConstraintError = (error: unknown): boolean =>
  error instanceof Error && /SQLITE_CONSTRAINT|constraint failed/i.test(error.message);

export class SecurityRepositorySqlite implements SecurityRepository {
  constructor(private readonly database: SqliteDatabase, private readonly onRealtimePolicyChanged: (userId?: string) => void = () => undefined) {}

  async listRoles(): Promise<RoleListItemDto[]> {
    return this.database.all<RoleListRow>(`SELECT r.*,COUNT(rp.permission_id) AS permissionCount FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id WHERE r.deleted_at IS NULL GROUP BY r.id ORDER BY r.name`).map((row) => ({
      id: row.id, roleKey: row.role_key, name: row.name, description: row.description ?? '', isSystem: Boolean(row.is_system), permissionCount: Number(row.permissionCount), updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  async getRoleByKey(key: string): Promise<RoleDetailDto | null> {
    const row = this.database.get<RoleRow>('SELECT * FROM roles WHERE role_key=? AND deleted_at IS NULL', [key.trim()]);
    if (!row) return null;
    return { id: row.id, roleKey: row.role_key, name: row.name, description: row.description ?? '', isSystem: Boolean(row.is_system), rowVersion: Number(row.row_version), permissions: this.database.all<PermissionDto>(`SELECT p.id,p.permission_key AS permissionKey,p.name,p.description,p.resource_kind AS resourceKind FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=? ORDER BY p.permission_key`, [row.id]), allAvailablePermissions: await this.listAllPermissions(), updatedAt: new Date(row.updated_at).toISOString() };
  }

  async findRoleById(id: string): Promise<Role | null> { return this.role(this.database.get<RoleRow>('SELECT * FROM roles WHERE id=? AND deleted_at IS NULL', [id])); }
  async findRoleByKey(key: string): Promise<Role | null> { return this.role(this.database.get<RoleRow>('SELECT * FROM roles WHERE role_key=? AND deleted_at IS NULL', [key.trim()])); }
  async listRolePermissionKeys(id: string): Promise<string[]> { return this.database.all<{ permission_key: string }>('SELECT p.permission_key FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=? ORDER BY p.permission_key', [id]).map((row) => row.permission_key); }
  async createRole(role: Role, permissionIds: string[] = []): Promise<void> { this.database.run('INSERT INTO roles(id,role_key,name,description,is_system,row_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', [role.id, role.roleKey, role.name, role.description, role.isSystem ? 1 : 0, role.rowVersion, role.createdAt.toISOString(), role.updatedAt.toISOString()]); await this.updateRolePermissions(role.id, permissionIds); }

  async updateRole(role: Role): Promise<void> {
    const result = this.database.run('UPDATE roles SET name=?,description=?,row_version=?,updated_at=? WHERE id=? AND row_version=? AND deleted_at IS NULL', [role.name, role.description, role.rowVersion, role.updatedAt.toISOString(), role.id, role.rowVersion - 1]);
    if (!result.changes) {
      const current = this.database.get<{ row_version: number }>('SELECT row_version FROM roles WHERE id=?', [role.id]);
      throw new RowVersionMismatchError(role.rowVersion - 1, Number(current?.row_version ?? 0));
    }
  }

  async updateRolePermissions(id: string, permissionIds: string[]): Promise<void> { const users = this.database.all<{ user_id: string }>('SELECT user_id FROM user_roles WHERE role_id=? UNION SELECT user_id FROM node_scope_assignments WHERE role_id=?', [id, id]); this.database.run('DELETE FROM role_permissions WHERE role_id=?', [id]); for (const permissionId of permissionIds) this.database.run('INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?,?)', [id, permissionId]); for (const user of users) this.onRealtimePolicyChanged(user.user_id); }
  async listAllPermissions(): Promise<PermissionDto[]> { return this.database.all<PermissionDto>('SELECT id,permission_key AS permissionKey,name,description,resource_kind AS resourceKind FROM permissions ORDER BY permission_key'); }
  async listScopeAssignments(): Promise<ScopeAssignmentDto[]> { return this.scopeQuery(''); }
  async listScopeAssignmentsManageableBy(actor: string): Promise<ScopeAssignmentDto[]> {
    const actorRow = this.database.get<ActorRow>('SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL', [actor]);
    if (actorRow?.is_super_admin) return this.scopeQuery('');
    const manageableUserIds = await this.manageableUserIds(actor);
    if (manageableUserIds.length === 0) return [];
    return this.scopeQuery(` AND sa.user_id IN (${manageableUserIds.map(() => '?').join(',')})`, manageableUserIds);
  }
  async getScopeAssignmentById(id: string): Promise<ScopeAssignmentDto | null> { return (await this.scopeQuery(' AND sa.id=?', [id]))[0] ?? null; }
  async getScopeAssignmentManageableBy(actor: string, id: string): Promise<ScopeAssignmentDto | null> { return (await this.listScopeAssignmentsManageableBy(actor)).find((assignment) => assignment.id === id) ?? null; }
  async listRealtimeScopeAssignments(userId: string): Promise<RealtimeScopeAssignmentDto[]> { return this.database.all<RealtimeScopeAssignmentRow>(`SELECT DISTINCT sa.node_id AS nodeId,sa.propagation FROM node_scope_assignments sa JOIN role_permissions rp ON rp.role_id=sa.role_id JOIN permissions p ON p.id=rp.permission_id WHERE sa.user_id=? AND sa.assignment_effect='allow' AND p.permission_key IN('node.read','entity.read') ORDER BY sa.node_id,sa.propagation`, [userId]); }
  async listRealtimeVirtualRootNodeIds(userId: string): Promise<string[]> {
    const user = this.database.get<ActorRow>('SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL', [userId]);
    if (user?.is_super_admin) return this.database.all<{ id: string }>('SELECT id FROM nodes WHERE parent_id IS NULL AND deleted_at IS NULL').map((row) => row.id);
    return this.database.all<{ id: string }>(`SELECT DISTINCT n.id FROM nodes n JOIN node_scope_assignments allow_assignment ON allow_assignment.node_id=n.id JOIN role_permissions allow_rp ON allow_rp.role_id=allow_assignment.role_id JOIN permissions allow_permission ON allow_permission.id=allow_rp.permission_id WHERE n.deleted_at IS NULL AND allow_assignment.user_id=? AND allow_assignment.assignment_effect='allow' AND allow_permission.permission_key='node.read' AND NOT EXISTS (SELECT 1 FROM node_scope_assignments deny_assignment JOIN role_permissions deny_rp ON deny_rp.role_id=deny_assignment.role_id JOIN permissions deny_permission ON deny_permission.id=deny_rp.permission_id JOIN nodes deny_node ON deny_node.id=deny_assignment.node_id WHERE deny_assignment.user_id=? AND deny_assignment.assignment_effect='deny' AND deny_permission.permission_key='node.read' AND (deny_assignment.node_id=n.id OR (deny_assignment.propagation='subtree' AND (n.path=deny_node.path OR n.path LIKE deny_node.path || '.%')))) ORDER BY n.id`, [userId, userId]).map((row) => row.id);
  }
  async listRealtimeChannelPolicies(): Promise<RealtimeChannelPolicy[]> { return this.policies(); }
  async listRealtimeChannelPoliciesForUser(userId: string): Promise<RealtimeChannelPolicy[]> { return this.policies(userId); }

  async createScopeAssignment(id: string, userId: string, nodeId: string, roleId: string, effect: 'allow' | 'deny', propagation: 'self' | 'subtree', assignedBy: string): Promise<void> {
    await this.assertScopeAssignmentTargets(userId, nodeId, roleId, propagation);
    try { this.database.transaction(() => { this.database.run('INSERT INTO node_scope_assignments(id,user_id,node_id,role_id,assignment_effect,propagation) VALUES(?,?,?,?,?,?)', [id, userId, nodeId, roleId, effect, propagation]); this.database.run('INSERT INTO scope_assignment_metadata(assignment_id,assigned_by) VALUES(?,?)', [id, assignedBy]); }); }
    catch (error: unknown) { this.throwScopeAssignmentError(error); }
    this.onRealtimePolicyChanged(userId);
  }

  async updateScopeAssignment(id: string, roleId: string, effect: 'allow' | 'deny', propagation: 'self' | 'subtree'): Promise<void> {
    const previous = this.database.get<ScopeAssignmentOwnerRow & { node_id: string }>('SELECT user_id,node_id FROM node_scope_assignments WHERE id=?', [id]);
    if (!previous) throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`);
    await this.assertScopeAssignmentTargets(previous.user_id, previous.node_id, roleId, propagation, id);
    try { this.database.run('UPDATE node_scope_assignments SET role_id=?,assignment_effect=?,propagation=? WHERE id=?', [roleId, effect, propagation, id]); }
    catch (error: unknown) { this.throwScopeAssignmentError(error); }
    this.onRealtimePolicyChanged(previous.user_id);
  }

  async deleteScopeAssignment(id: string): Promise<void> { const previous = this.database.get<ScopeAssignmentOwnerRow>('SELECT user_id FROM node_scope_assignments WHERE id=?', [id]); if (!previous) throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`); this.database.run('DELETE FROM node_scope_assignments WHERE id=?', [id]); this.onRealtimePolicyChanged(previous.user_id); }
  async revokeDelegatedScopeAssignmentsOutsideCoverage(): Promise<RevokedDelegatedScopeAssignmentDto[]> {
    const revoked: RevokedDelegatedScopeAssignmentDto[] = [];
    for (;;) {
      const assignments = this.database.all<AssignmentCoverageRow>(`SELECT sa.id,sa.user_id,sa.node_id,sa.role_id,sa.propagation,m.assigned_by FROM node_scope_assignments sa JOIN scope_assignment_metadata m ON m.assignment_id=sa.id WHERE m.assigned_by IS NOT NULL`);
      const invalid = assignments.find((assignment) => !this.delegatorCovers(assignment));
      if (!invalid) break;
      this.database.run('DELETE FROM node_scope_assignments WHERE id=?', [invalid.id]);
      revoked.push({ id: invalid.id, userId: invalid.user_id, nodeId: invalid.node_id, roleId: invalid.role_id, assignedBy: invalid.assigned_by! });
      this.onRealtimePolicyChanged(invalid.user_id);
    }
    return revoked;
  }

  private role(row: RoleRow | undefined): Role | null { return row ? new Role(row.id, row.role_key, row.name, row.description ?? '', Boolean(row.is_system), Number(row.row_version), new Date(row.created_at), new Date(row.updated_at), row.deleted_at ? new Date(row.deleted_at) : null) : null; }
  private async scopeQuery(extra: string, parameters: readonly unknown[] = []): Promise<ScopeAssignmentDto[]> { return this.database.all<ScopeAssignmentRow>(`SELECT sa.id,sa.user_id AS userId,u.email AS userEmail,sa.node_id AS nodeId,COALESCE(n.name,'Root Node') AS nodeName,sa.role_id AS roleId,r.name AS roleName,sa.assignment_effect AS assignmentEffect,sa.propagation,COALESCE(m.assigned_at,sa.rowid) AS assignedAt FROM node_scope_assignments sa JOIN users u ON u.id=sa.user_id LEFT JOIN nodes n ON n.id=sa.node_id LEFT JOIN roles r ON r.id=sa.role_id LEFT JOIN scope_assignment_metadata m ON m.assignment_id=sa.id WHERE 1=1${extra} ORDER BY assignedAt DESC`, parameters).map((row) => ({ ...row, assignedAt: new Date(row.assignedAt).toISOString() })); }
  private async policies(userId?: string): Promise<RealtimeChannelPolicy[]> {
    const users = this.database.all<RealtimePolicyUserRow>(`SELECT id,is_super_admin AS isSuperAdmin FROM users WHERE is_active=1 AND deleted_at IS NULL${userId ? ' AND id=?' : ''}`, userId ? [userId] : []);
    const policies = new Map<string, RealtimeChannelPolicy>();
    const administrativePermissions = new Set<RealtimePermissionKey>(['node_type.read', 'entity_type.read', 'user.read', 'role.read', 'scope.read', 'audit.access', 'system.config.read']);
    for (const user of users) {
      const rules = this.database.all<RealtimePolicyRuleRow>(`SELECT sa.node_id AS nodeId,sa.assignment_effect AS assignmentEffect,sa.propagation,p.permission_key AS permissionKey FROM node_scope_assignments sa JOIN role_permissions rp ON rp.role_id=sa.role_id JOIN permissions p ON p.id=rp.permission_id WHERE sa.user_id=? AND p.permission_key IN('node.read','entity.read')`, [user.id]);
      const directPermissions = this.database.all<{ permission_key: RealtimePermissionKey }>(`SELECT DISTINCT p.permission_key FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?`, [user.id]);
      for (const permission of directPermissions) if (administrativePermissions.has(permission.permission_key)) rules.push({ nodeId: null, assignmentEffect: 'allow', propagation: 'global', permissionKey: permission.permission_key });
      if (user.isSuperAdmin || rules.length) { const policy = createRealtimeChannelPolicy(rules, Boolean(user.isSuperAdmin)); policies.set(policy.channelId, policy); }
    }
    return [...policies.values()];
  }
  private async assertScopeAssignmentTargets(userId: string, nodeId: string, roleId: string, propagation: 'self' | 'subtree', excludedId?: string): Promise<void> {
    const row = this.database.get<ScopeTargetValidationRow>(`SELECT EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL) AS activeUser, EXISTS(SELECT 1 FROM nodes WHERE id=? AND deleted_at IS NULL) AS activeNode, EXISTS(SELECT 1 FROM roles WHERE id=? AND deleted_at IS NULL) AS activeRole, EXISTS(SELECT 1 FROM node_scope_assignments WHERE user_id=? AND node_id=? AND role_id=? AND propagation=? AND id<>?) AS conflictingAssignment`, [userId, nodeId, roleId, userId, nodeId, roleId, propagation, excludedId ?? '']);
    const issues: Record<string, string[]> = {};
    if (!row?.activeUser) issues.userId = ['The target user must exist and be active.'];
    if (!row?.activeNode) issues.nodeId = ['The target node must exist and be active.'];
    if (!row?.activeRole) issues.roleId = ['The target role must exist and be active.'];
    if (row?.conflictingAssignment) issues.assignment = ['An allow/deny assignment already exists for this user, node, role and propagation.'];
    if (Object.keys(issues).length) throw new SecurityAdminValidationError('Invalid or contradictory scope assignment.', issues);
  }
  private async manageableUserIds(actor: string): Promise<string[]> { const candidates = this.database.all<{ id: string }>(`SELECT DISTINCT u.id FROM users u JOIN node_scope_assignments sa ON sa.user_id=u.id WHERE u.deleted_at IS NULL AND u.is_super_admin=0 AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.role_key NOT IN ('default_reader','scoped_reader'))`); const manageable: string[] = []; for (const candidate of candidates) { const assignments = this.database.all<AssignmentCoverageRow>(`SELECT sa.id,sa.user_id,sa.node_id,sa.role_id,sa.propagation,COALESCE(m.assigned_by,'') AS assigned_by FROM node_scope_assignments sa LEFT JOIN scope_assignment_metadata m ON m.assignment_id=sa.id WHERE sa.user_id=? AND sa.assignment_effect='allow'`, [candidate.id]); if (assignments.length && assignments.every((assignment) => this.actorCanAssign(actor, assignment.node_id, assignment.propagation))) manageable.push(candidate.id); } return manageable; }
  private actorCanAssign(actor: string, nodeId: string, propagation: 'self' | 'subtree'): boolean { return hasSqlitePermissionCoverage(this.database, actor, 'scope.assign', nodeId, propagation); }
  private delegatorCovers(assignment: AssignmentCoverageRow): boolean { const delegator = this.database.get<ActorRow>(`SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL`, [assignment.assigned_by]); if (!delegator) return false; if (delegator.is_super_admin) return true; const permissions = this.database.all<{ permission_key: string }>('SELECT p.permission_key FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=?', [assignment.role_id]); return permissions.every((permission) => this.actorHasPermissionCoverage(assignment.assigned_by!, assignment.node_id, assignment.propagation, permission.permission_key)); }
  private actorHasPermissionCoverage(actor: string, nodeId: string, propagation: 'self' | 'subtree', permissionKey: string): boolean { return hasSqlitePermissionCoverage(this.database, actor, permissionKey, nodeId, propagation); }
  private throwScopeAssignmentError(error: unknown): never { if (isSqliteConstraintError(error)) throw new SecurityAdminValidationError('Invalid or contradictory scope assignment.'); throw error; }
}
