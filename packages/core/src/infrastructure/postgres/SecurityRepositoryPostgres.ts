import { SecurityRepository } from '../../application/ports/SecurityRepository.js';
import { Role } from '../../domain/models/Role.js';
import {
  RoleListItemDto,
  RoleDetailDto,
  PermissionDto,
  ScopeAssignmentDto,
  RevokedDelegatedScopeAssignmentDto,
  RealtimeScopeAssignmentDto,
} from '../../application/dto/SecurityAdminDtos.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { SecurityAdminValidationError } from '../../domain/errors/SecurityAdminErrors.js';
import { PgExecutor } from './PgExecutor.js';
import {
  createRealtimeChannelPolicy,
  type RealtimeChannelPolicy,
  type RealtimeChannelRule,
} from '../../application/realtime/RealtimeChannelPolicy.js';

interface RoleRow {
  id: string;
  role_key: string;
  name: string;
  description: string;
  is_system: boolean;
  row_version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RoleListRow {
  id: string;
  roleKey: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  updatedAt: Date;
  permissionCount: number;
}

interface RoleDetailRow {
  id: string;
  roleKey: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rowVersion: number;
  updatedAt: Date;
}

interface PermissionRow extends PermissionDto {}

interface ScopeAssignmentRow {
  id: string;
  userId: string;
  userEmail: string;
  nodeId: string;
  nodeName: string;
  roleId: string;
  roleName: string;
  assignmentEffect: 'allow' | 'deny';
  propagation: 'self' | 'subtree';
  assignedAt: Date;
}

export class SecurityRepositoryPostgres implements SecurityRepository {
  constructor(
    private readonly executor: PgExecutor,
    private readonly onRealtimePolicyChanged: (userId?: string) => void = () => undefined,
  ) {}

  async listRoles(): Promise<RoleListItemDto[]> {
    const query = `
      SELECT 
        r.id,
        r.role_key AS "roleKey",
        r.name,
        r.description,
        r.is_system AS "isSystem",
        r.updated_at AS "updatedAt",
        COUNT(rp.permission_id)::int AS "permissionCount"
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      WHERE r.deleted_at IS NULL
      GROUP BY r.id
      ORDER BY r.name ASC
    `;
    const res = await this.executor.query<RoleListRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      roleKey: r.roleKey,
      name: r.name,
      description: r.description ?? '',
      isSystem: Boolean(r.isSystem),
      permissionCount: Number(r.permissionCount || 0),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  async getRoleByKey(roleKey: string): Promise<RoleDetailDto | null> {
    const roleQuery = `
      SELECT id, role_key AS "roleKey", name, description, is_system AS "isSystem", row_version AS "rowVersion", updated_at AS "updatedAt"
      FROM roles
      WHERE role_key = $1 AND deleted_at IS NULL
    `;
    const roleRes = await this.executor.query<RoleDetailRow>(roleQuery, [roleKey.trim()]);
    if (roleRes.rows.length === 0) {
      return null;
    }
    const r = roleRes.rows[0];
    if (!r) {
      return null;
    }

    const permissionsQuery = `
      SELECT p.id, p.permission_key AS "permissionKey", p.name, p.description, p.resource_kind AS "resourceKind"
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      ORDER BY p.permission_key ASC
    `;
    const permRes = await this.executor.query<PermissionRow>(permissionsQuery, [r.id]);

    const allPermissions = await this.listAllPermissions();

    return {
      id: r.id,
      roleKey: r.roleKey,
      name: r.name,
      description: r.description ?? '',
      isSystem: Boolean(r.isSystem),
      rowVersion: Number(r.rowVersion),
      permissions: permRes.rows,
      allAvailablePermissions: allPermissions,
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  }

  async findRoleById(id: string): Promise<Role | null> {
    const query = `
      SELECT id, role_key, name, description, is_system, row_version, created_at, updated_at, deleted_at
      FROM roles
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const res = await this.executor.query<RoleRow>(query, [id]);
    const row = res.rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async findRoleByKey(roleKey: string): Promise<Role | null> {
    const query = `
      SELECT id, role_key, name, description, is_system, row_version, created_at, updated_at, deleted_at
      FROM roles
      WHERE role_key = $1 AND deleted_at IS NULL
    `;
    const res = await this.executor.query<RoleRow>(query, [roleKey.trim()]);
    const row = res.rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async listRolePermissionKeys(roleId: string): Promise<string[]> {
    const result = await this.executor.query<{ permission_key: string }>(
      `SELECT p.permission_key
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.permission_key ASC`,
      [roleId]
    );
    return result.rows.map((row) => row.permission_key);
  }

  async createRole(role: Role, permissionIds: string[] = []): Promise<void> {
    await this.executor.query(
      `INSERT INTO roles (id, role_key, name, description, is_system, row_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [role.id, role.roleKey, role.name, role.description, role.isSystem, role.rowVersion, role.createdAt, role.updatedAt]
    );

    if (permissionIds.length > 0) {
      await this.updateRolePermissions(role.id, permissionIds);
    } else {
      this.onRealtimePolicyChanged();
    }
  }

  async updateRole(role: Role): Promise<void> {
    const previousRowVersion = role.rowVersion - 1;
    const query = `
      UPDATE roles
      SET name = $1, description = $2, row_version = $3, updated_at = $4
      WHERE id = $5 AND row_version = $6 AND deleted_at IS NULL
    `;
    const res = await this.executor.query(query, [
      role.name,
      role.description,
      role.rowVersion,
      role.updatedAt,
      role.id,
      previousRowVersion,
    ]);

    if (res.rowCount === 0) {
      const check = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM roles WHERE id = $1',
        [role.id]
      );
      const actual = check.rows[0]?.row_version ?? 0;
      throw new RowVersionMismatchError(previousRowVersion, actual);
    }
  }

  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const affectedUsers = await this.executor.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM node_scope_assignments WHERE role_id = $1
       UNION
       SELECT DISTINCT user_id FROM user_roles WHERE role_id = $1`,
      [roleId]
    );
    await this.executor.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    for (const permId of permissionIds) {
      await this.executor.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleId, permId]
      );
    }
    affectedUsers.rows.forEach((row) => this.onRealtimePolicyChanged(row.user_id));
  }

  async listAllPermissions(): Promise<PermissionDto[]> {
    const query = `
      SELECT id, permission_key AS "permissionKey", name, description, resource_kind AS "resourceKind"
      FROM permissions
      ORDER BY permission_key ASC
    `;
    const res = await this.executor.query<PermissionRow>(query);
    return res.rows;
  }

  async listScopeAssignments(): Promise<ScopeAssignmentDto[]> {
    const query = `
      SELECT 
        sa.id,
        sa.user_id AS "userId",
        u.email AS "userEmail",
        sa.node_id AS "nodeId",
        COALESCE(n.name, 'Root Node') AS "nodeName",
        sa.role_id AS "roleId",
        r.name AS "roleName",
        sa.assignment_effect AS "assignmentEffect",
        sa.propagation,
        sa.assigned_at AS "assignedAt"
      FROM node_scope_assignments sa
      INNER JOIN users u ON u.id = sa.user_id
      LEFT JOIN nodes n ON n.id = sa.node_id
      LEFT JOIN roles r ON r.id = sa.role_id
      ORDER BY sa.assigned_at DESC
    `;
    const res = await this.executor.query<ScopeAssignmentRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.userEmail,
      nodeId: r.nodeId,
      nodeName: r.nodeName,
      roleId: r.roleId,
      roleName: r.roleName,
      assignmentEffect: r.assignmentEffect,
      propagation: r.propagation,
      assignedAt: new Date(r.assignedAt).toISOString(),
    }));
  }

  async listScopeAssignmentsManageableBy(actorUserId: string): Promise<ScopeAssignmentDto[]> {
    const res = await this.executor.query<ScopeAssignmentRow>(`
      WITH actor AS (
        SELECT is_super_admin FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL
      ), delegable AS (
        SELECT n.path
        FROM node_scope_assignments grant
        JOIN nodes n ON n.id = grant.node_id AND n.deleted_at IS NULL
        JOIN role_permissions rp ON rp.role_id = grant.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE grant.user_id = $1
          AND grant.assignment_effect = 'allow'::assignment_effect_enum
          AND grant.propagation = 'subtree'::scope_propagation_enum
          AND p.permission_key = 'scope.assign'
          AND NOT EXISTS (
            SELECT 1 FROM node_scope_assignments deny
            JOIN nodes deny_node ON deny_node.id = deny.node_id AND deny_node.deleted_at IS NULL
            JOIN role_permissions deny_rp ON deny_rp.role_id = deny.role_id
            JOIN permissions deny_permission ON deny_permission.id = deny_rp.permission_id
            WHERE deny.user_id = $1 AND deny.assignment_effect = 'deny'::assignment_effect_enum
              AND deny_permission.permission_key = 'scope.assign'
              AND ((deny.propagation = 'self'::scope_propagation_enum AND n.path @> deny_node.path)
                OR (deny.propagation = 'subtree'::scope_propagation_enum AND (n.path @> deny_node.path OR deny_node.path @> n.path)))
          )
      )
      SELECT sa.id, sa.user_id AS "userId", u.email AS "userEmail", sa.node_id AS "nodeId",
             COALESCE(n.name, 'Root Node') AS "nodeName", sa.role_id AS "roleId", r.name AS "roleName",
             sa.assignment_effect AS "assignmentEffect", sa.propagation, sa.assigned_at AS "assignedAt"
      FROM node_scope_assignments sa
      JOIN users u ON u.id = sa.user_id AND u.deleted_at IS NULL
      JOIN nodes n ON n.id = sa.node_id AND n.deleted_at IS NULL
      JOIN roles r ON r.id = sa.role_id AND r.deleted_at IS NULL
      WHERE (SELECT is_super_admin FROM actor) = true
         OR EXISTS (SELECT 1 FROM delegable d WHERE d.path @> n.path)
      ORDER BY sa.assigned_at DESC
    `, [actorUserId]);
    return res.rows.map((r) => this.mapScopeAssignment(r));
  }

  async getScopeAssignmentById(id: string): Promise<ScopeAssignmentDto | null> {
    const query = `
      SELECT
        sa.id,
        sa.user_id AS "userId",
        u.email AS "userEmail",
        sa.node_id AS "nodeId",
        COALESCE(n.name, 'Root Node') AS "nodeName",
        sa.role_id AS "roleId",
        r.name AS "roleName",
        sa.assignment_effect AS "assignmentEffect",
        sa.propagation,
        sa.assigned_at AS "assignedAt"
      FROM node_scope_assignments sa
      INNER JOIN users u ON u.id = sa.user_id
      LEFT JOIN nodes n ON n.id = sa.node_id
      LEFT JOIN roles r ON r.id = sa.role_id
      WHERE sa.id = $1
    `;
    const res = await this.executor.query<ScopeAssignmentRow>(query, [id]);
    const row = res.rows[0];
    if (!row) return null;

    return this.mapScopeAssignment(row);
  }

  async getScopeAssignmentManageableBy(actorUserId: string, id: string): Promise<ScopeAssignmentDto | null> {
    const result = await this.executor.query<ScopeAssignmentRow>(`
      WITH actor AS (
        SELECT is_super_admin FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL
      ), delegable AS (
        SELECT n.path
        FROM node_scope_assignments grant
        JOIN nodes n ON n.id = grant.node_id AND n.deleted_at IS NULL
        JOIN role_permissions rp ON rp.role_id = grant.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE grant.user_id = $1 AND grant.assignment_effect = 'allow'::assignment_effect_enum
          AND grant.propagation = 'subtree'::scope_propagation_enum AND p.permission_key = 'scope.assign'
          AND NOT EXISTS (
            SELECT 1 FROM node_scope_assignments deny
            JOIN nodes deny_node ON deny_node.id = deny.node_id AND deny_node.deleted_at IS NULL
            JOIN role_permissions deny_rp ON deny_rp.role_id = deny.role_id
            JOIN permissions deny_permission ON deny_permission.id = deny_rp.permission_id
            WHERE deny.user_id = $1 AND deny.assignment_effect = 'deny'::assignment_effect_enum
              AND deny_permission.permission_key = 'scope.assign'
              AND ((deny.propagation = 'self'::scope_propagation_enum AND n.path @> deny_node.path)
                OR (deny.propagation = 'subtree'::scope_propagation_enum AND (n.path @> deny_node.path OR deny_node.path @> n.path)))
          )
      )
      SELECT sa.id, sa.user_id AS "userId", u.email AS "userEmail", sa.node_id AS "nodeId",
             COALESCE(n.name, 'Root Node') AS "nodeName", sa.role_id AS "roleId", r.name AS "roleName",
             sa.assignment_effect AS "assignmentEffect", sa.propagation, sa.assigned_at AS "assignedAt"
      FROM node_scope_assignments sa
      JOIN users u ON u.id = sa.user_id AND u.deleted_at IS NULL
      JOIN nodes n ON n.id = sa.node_id AND n.deleted_at IS NULL
      JOIN roles r ON r.id = sa.role_id AND r.deleted_at IS NULL
      WHERE sa.id = $2
        AND ((SELECT is_super_admin FROM actor) = true OR EXISTS (SELECT 1 FROM delegable d WHERE d.path @> n.path))
    `, [actorUserId, id]);
    return result.rows[0] ? this.mapScopeAssignment(result.rows[0]) : null;
  }

  async listRealtimeScopeAssignments(userId: string): Promise<RealtimeScopeAssignmentDto[]> {
    const query = `
      SELECT DISTINCT sa.node_id AS "nodeId", sa.propagation
      FROM node_scope_assignments sa
      JOIN role_permissions rp ON rp.role_id = sa.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE sa.user_id = $1
        AND sa.assignment_effect = 'allow'::assignment_effect_enum
        AND p.permission_key IN ('node.read', 'entity.read')
      ORDER BY sa.node_id, sa.propagation
    `;
    const res = await this.executor.query<RealtimeScopeAssignmentDto>(query, [userId]);
    return res.rows;
  }

  async listRealtimeVirtualRootNodeIds(userId: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT n.id
      FROM nodes n
      WHERE n.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = $1 AND u.is_super_admin = true
          )
          AND n.parent_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM node_scope_assignments sa
            JOIN role_permissions rp ON rp.role_id = sa.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE sa.user_id = $1
              AND sa.node_id = n.id
              AND sa.assignment_effect = 'allow'::assignment_effect_enum
              AND p.permission_key = 'node.read'
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM node_scope_assignments deny
          JOIN role_permissions rp ON rp.role_id = deny.role_id
          JOIN permissions p ON p.id = rp.permission_id
          JOIN nodes deny_node ON deny_node.id = deny.node_id
          WHERE deny.user_id = $1
            AND deny.assignment_effect = 'deny'::assignment_effect_enum
            AND p.permission_key = 'node.read'
            AND (
              (deny.propagation = 'self'::scope_propagation_enum AND deny.node_id = n.id)
              OR
              (deny.propagation = 'subtree'::scope_propagation_enum AND deny_node.path @> n.path)
            )
        )
      ORDER BY n.id
    `;
    const result = await this.executor.query<{ id: string }>(query, [userId]);
    return result.rows.map((row) => row.id);
  }

  async listRealtimeChannelPolicies(): Promise<RealtimeChannelPolicy[]> {
    return this.loadRealtimeChannelPolicies();
  }

  async listRealtimeChannelPoliciesForUser(userId: string): Promise<RealtimeChannelPolicy[]> {
    const policies = await this.loadRealtimeChannelPolicies(userId);
    return policies;
  }

  private async loadRealtimeChannelPolicies(userId?: string): Promise<RealtimeChannelPolicy[]> {
    const query = `
      SELECT
        u.id AS "userId",
        u.is_super_admin AS "isSuperAdmin",
        sa.node_id AS "nodeId",
        sa.assignment_effect AS "assignmentEffect",
        sa.propagation,
        p.permission_key AS "permissionKey"
      FROM users u
      LEFT JOIN node_scope_assignments sa ON sa.user_id = u.id
      LEFT JOIN role_permissions rp ON rp.role_id = sa.role_id
      LEFT JOIN permissions p ON p.id = rp.permission_id
        AND p.permission_key IN ('node.read', 'entity.read')
      WHERE u.is_active = true
        ${userId ? 'AND u.id = $1' : ''}
      ORDER BY u.id, sa.node_id, sa.propagation, p.permission_key
    `;
    const result = await this.executor.query<{
      userId: string;
      isSuperAdmin: boolean;
      nodeId: string | null;
      assignmentEffect: 'allow' | 'deny' | null;
      propagation: 'self' | 'subtree' | null;
      permissionKey: 'node.read' | 'entity.read' | null;
    }>(query, userId ? [userId] : []);

    const rulesByUser = new Map<string, { isGlobal: boolean; rules: RealtimeChannelRule[] }>();
    for (const row of result.rows) {
      const current = rulesByUser.get(row.userId) ?? { isGlobal: Boolean(row.isSuperAdmin), rules: [] };
      current.isGlobal ||= Boolean(row.isSuperAdmin);
      if (row.nodeId && row.assignmentEffect && row.propagation && row.permissionKey) {
        current.rules.push({
          nodeId: row.nodeId,
          assignmentEffect: row.assignmentEffect,
          propagation: row.propagation,
          permissionKey: row.permissionKey,
        });
      }
      rulesByUser.set(row.userId, current);
    }

    const uniquePolicies = new Map<string, RealtimeChannelPolicy>();
    for (const entry of rulesByUser.values()) {
      if (!entry.isGlobal && entry.rules.length === 0) continue;
      const policy = createRealtimeChannelPolicy(entry.rules, entry.isGlobal);
      uniquePolicies.set(policy.channelId, policy);
    }
    return [...uniquePolicies.values()];
  }

  async createScopeAssignment(
    id: string,
    userId: string,
    nodeId: string,
    roleId: string,
    assignmentEffect: 'allow' | 'deny',
    propagation: 'self' | 'subtree',
    assignedBy: string
  ): Promise<void> {
    await this.assertScopeAssignmentTargets(userId, nodeId, roleId, assignmentEffect, propagation);
    const query = `
      INSERT INTO node_scope_assignments (id, user_id, node_id, role_id, assignment_effect, propagation, assigned_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await this.executor.query(query, [id, userId, nodeId, roleId, assignmentEffect, propagation, assignedBy]);
    this.onRealtimePolicyChanged(userId);
  }

  async updateScopeAssignment(
    id: string,
    roleId: string,
    assignmentEffect: 'allow' | 'deny',
    propagation: 'self' | 'subtree'
  ): Promise<void> {
    const existing = await this.executor.query<{ user_id: string; node_id: string }>(
      'SELECT user_id, node_id FROM node_scope_assignments WHERE id = $1', [id]
    );
    const assignment = existing.rows[0];
    if (!assignment) throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`);
    await this.assertScopeAssignmentTargets(
      assignment.user_id, assignment.node_id, roleId, assignmentEffect, propagation, id
    );
    const query = `
      UPDATE node_scope_assignments
      SET role_id = $1, assignment_effect = $2, propagation = $3
      WHERE id = $4
      RETURNING user_id
    `;
    const result = await this.executor.query<{ user_id: string }>(query, [roleId, assignmentEffect, propagation, id]);
    if (result.rowCount === 0) {
      throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`);
    }
    this.onRealtimePolicyChanged(result.rows[0]?.user_id);
  }

  async deleteScopeAssignment(id: string): Promise<void> {
    const result = await this.executor.query<{ user_id: string }>(
      'DELETE FROM node_scope_assignments WHERE id = $1 RETURNING user_id', [id]
    );
    if (result.rowCount === 0) {
      throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`);
    }
    this.onRealtimePolicyChanged(result.rows[0]?.user_id);
  }

  async revokeDelegatedScopeAssignmentsOutsideCoverage(): Promise<RevokedDelegatedScopeAssignmentDto[]> {
    const revoked: RevokedDelegatedScopeAssignmentDto[] = [];
    // A removed parent grant can invalidate grants created by that delegate.
    // Repeat the set-based deletion to reach the transitive fixed point.
    for (;;) {
      const result = await this.executor.query<{
        id: string; user_id: string; node_id: string; role_id: string; assigned_by: string;
      }>(`
        DELETE FROM node_scope_assignments target
        USING nodes target_node
        WHERE target.node_id = target_node.id
          AND target.assigned_by IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM users delegator
            WHERE delegator.id = target.assigned_by AND delegator.is_active AND delegator.deleted_at IS NULL
              AND (
                delegator.is_super_admin
                OR NOT EXISTS (
                  SELECT 1
                  FROM role_permissions target_rp
                  JOIN permissions required_permission ON required_permission.id = target_rp.permission_id
                  WHERE target_rp.role_id = target.role_id
                    AND NOT EXISTS (
                      SELECT 1
                      FROM node_scope_assignments allow_assignment
                      JOIN nodes allow_node ON allow_node.id = allow_assignment.node_id AND allow_node.deleted_at IS NULL
                      JOIN role_permissions allow_rp ON allow_rp.role_id = allow_assignment.role_id
                      JOIN permissions allow_permission ON allow_permission.id = allow_rp.permission_id
                      WHERE allow_assignment.user_id = target.assigned_by
                        AND allow_assignment.assignment_effect = 'allow'::assignment_effect_enum
                        AND allow_permission.permission_key = required_permission.permission_key
                        AND (
                          (target.propagation = 'self'::scope_propagation_enum AND
                            ((allow_assignment.propagation = 'self'::scope_propagation_enum AND allow_node.id = target.node_id)
                             OR (allow_assignment.propagation = 'subtree'::scope_propagation_enum AND allow_node.path @> target_node.path)))
                          OR
                          (target.propagation = 'subtree'::scope_propagation_enum
                            AND allow_assignment.propagation = 'subtree'::scope_propagation_enum
                            AND allow_node.path @> target_node.path)
                        )
                        AND NOT EXISTS (
                          SELECT 1
                          FROM node_scope_assignments deny_assignment
                          JOIN nodes deny_node ON deny_node.id = deny_assignment.node_id AND deny_node.deleted_at IS NULL
                          JOIN role_permissions deny_rp ON deny_rp.role_id = deny_assignment.role_id
                          JOIN permissions deny_permission ON deny_permission.id = deny_rp.permission_id
                          WHERE deny_assignment.user_id = target.assigned_by
                            AND deny_assignment.assignment_effect = 'deny'::assignment_effect_enum
                            AND deny_permission.permission_key = required_permission.permission_key
                            AND (
                              (target.propagation = 'self'::scope_propagation_enum
                                AND ((deny_assignment.propagation = 'self'::scope_propagation_enum AND deny_node.id = target.node_id)
                                  OR (deny_assignment.propagation = 'subtree'::scope_propagation_enum AND deny_node.path @> target_node.path)))
                              OR (target.propagation = 'subtree'::scope_propagation_enum
                                AND ((deny_assignment.propagation = 'self'::scope_propagation_enum AND target_node.path @> deny_node.path)
                                  OR (deny_assignment.propagation = 'subtree'::scope_propagation_enum
                                    AND (target_node.path @> deny_node.path OR deny_node.path @> target_node.path))))
                            )
                        )
                    )
                )
              )
          )
        RETURNING target.id, target.user_id, target.node_id, target.role_id, target.assigned_by
      `);
      if (result.rows.length === 0) break;
      revoked.push(...result.rows.map((row) => ({
        id: row.id, userId: row.user_id, nodeId: row.node_id, roleId: row.role_id, assignedBy: row.assigned_by,
      })));
    }
    revoked.forEach((assignment) => this.onRealtimePolicyChanged(assignment.userId));
    return revoked;
  }

  private mapToDomain(row: RoleRow): Role {
    return new Role(
      row.id,
      row.role_key,
      row.name,
      row.description,
      row.is_system,
      row.row_version,
      row.created_at,
      row.updated_at,
      row.deleted_at
    );
  }

  private mapScopeAssignment(row: ScopeAssignmentRow): ScopeAssignmentDto {
    return {
      id: row.id, userId: row.userId, userEmail: row.userEmail, nodeId: row.nodeId,
      nodeName: row.nodeName, roleId: row.roleId, roleName: row.roleName,
      assignmentEffect: row.assignmentEffect, propagation: row.propagation,
      assignedAt: new Date(row.assignedAt).toISOString(),
    };
  }

  /**
   * Enforces P1 integrity at the persistence boundary as well as at the
   * application boundary: a stale/inactive target cannot receive a grant and
   * an allow/deny pair for the same role, node and propagation is ambiguous.
   */
  private async assertScopeAssignmentTargets(
    userId: string,
    nodeId: string,
    roleId: string,
    assignmentEffect: 'allow' | 'deny',
    propagation: 'self' | 'subtree',
    excludeAssignmentId?: string,
  ): Promise<void> {
    const target = await this.executor.query<{
      active_user: boolean;
      active_node: boolean;
      active_role: boolean;
      conflicting_assignment: boolean;
    }>(`
      SELECT
        EXISTS (SELECT 1 FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL) AS active_user,
        EXISTS (SELECT 1 FROM nodes WHERE id = $2 AND deleted_at IS NULL) AS active_node,
        EXISTS (SELECT 1 FROM roles WHERE id = $3 AND deleted_at IS NULL) AS active_role,
        EXISTS (
          SELECT 1 FROM node_scope_assignments
          WHERE user_id = $1 AND node_id = $2 AND role_id = $3 AND propagation = $5::scope_propagation_enum
            AND id IS DISTINCT FROM $6
        ) AS conflicting_assignment
    `, [userId, nodeId, roleId, assignmentEffect, propagation, excludeAssignmentId ?? null]);
    const row = target.rows[0];
    const issues: Record<string, string[]> = {};
    if (!row?.active_user) issues.userId = ['The target user must exist and be active.'];
    if (!row?.active_node) issues.nodeId = ['The target node must exist and be active.'];
    if (!row?.active_role) issues.roleId = ['The target role must exist and be active.'];
    if (row?.conflicting_assignment) {
      issues.assignment = ['An allow/deny assignment already exists for this user, node, role and propagation.'];
    }
    if (Object.keys(issues).length > 0) {
      throw new SecurityAdminValidationError('Invalid or contradictory scope assignment.', issues);
    }
  }
}
