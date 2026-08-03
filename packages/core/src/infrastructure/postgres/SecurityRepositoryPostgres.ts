import { SecurityRepository } from '../../application/ports/SecurityRepository.js';
import { Role } from '../../domain/models/Role.js';
import {
  RoleListItemDto,
  RoleDetailDto,
  PermissionDto,
  ScopeAssignmentDto,
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
    private readonly onRealtimePolicyChanged: () => void = () => undefined,
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
    await this.executor.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    for (const permId of permissionIds) {
      await this.executor.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleId, permId]
      );
    }
    this.onRealtimePolicyChanged();
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

    return {
      id: row.id,
      userId: row.userId,
      userEmail: row.userEmail,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      roleId: row.roleId,
      roleName: row.roleName,
      assignmentEffect: row.assignmentEffect,
      propagation: row.propagation,
      assignedAt: new Date(row.assignedAt).toISOString(),
    };
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
    const query = `
      INSERT INTO node_scope_assignments (id, user_id, node_id, role_id, assignment_effect, propagation, assigned_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await this.executor.query(query, [id, userId, nodeId, roleId, assignmentEffect, propagation, assignedBy]);
    this.onRealtimePolicyChanged();
  }

  async updateScopeAssignment(
    id: string,
    roleId: string,
    assignmentEffect: 'allow' | 'deny',
    propagation: 'self' | 'subtree'
  ): Promise<void> {
    const query = `
      UPDATE node_scope_assignments
      SET role_id = $1, assignment_effect = $2, propagation = $3
      WHERE id = $4
    `;
    const result = await this.executor.query(query, [roleId, assignmentEffect, propagation, id]);
    if (result.rowCount === 0) {
      throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`);
    }
    this.onRealtimePolicyChanged();
  }

  async deleteScopeAssignment(id: string): Promise<void> {
    const result = await this.executor.query('DELETE FROM node_scope_assignments WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new SecurityAdminValidationError(`Scope assignment '${id}' not found.`);
    }
    this.onRealtimePolicyChanged();
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
}
