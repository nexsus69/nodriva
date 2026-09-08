/** Implements scoped access checks and batch read visibility for SQLite. */
import type { AccessControlPort } from '../../application/ports/AccessControlPort.js';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

export class AccessControlPortSqlite implements AccessControlPort {
  constructor(private readonly database: SqliteDatabase) {}

  /**
   * Canonical scoped-read predicate for SQLite query ports. The access policy
   * remains owned here; callers supply only a trusted target-table alias.
   */
  static getReadAccessControlSql(targetAlias: string, actorUserId: string, permissionKey: string): { sql: string; values: readonly string[] } {
    return {
      sql: `EXISTS (SELECT 1 FROM users actor WHERE actor.id=? AND actor.is_active=1 AND (
        actor.is_super_admin=1 OR (
          EXISTS (SELECT 1 FROM node_scope_assignments a
            JOIN role_permissions rp ON rp.role_id=a.role_id
            JOIN permissions p ON p.id=rp.permission_id
            WHERE a.user_id=actor.id AND p.permission_key=? AND a.assignment_effect='allow' AND
              ((a.propagation='self' AND a.node_id=${targetAlias}.id) OR
               (a.propagation='subtree' AND EXISTS (SELECT 1 FROM node_hierarchy h WHERE h.ancestor_id=a.node_id AND h.descendant_id=${targetAlias}.id))))
          AND NOT EXISTS (SELECT 1 FROM node_scope_assignments a
            JOIN role_permissions rp ON rp.role_id=a.role_id
            JOIN permissions p ON p.id=rp.permission_id
            WHERE a.user_id=actor.id AND p.permission_key=? AND a.assignment_effect='deny' AND
              ((a.propagation='self' AND a.node_id=${targetAlias}.id) OR
               (a.propagation='subtree' AND EXISTS (SELECT 1 FROM node_hierarchy h WHERE h.ancestor_id=a.node_id AND h.descendant_id=${targetAlias}.id))))
        )
      ))`,
      values: [actorUserId, permissionKey, permissionKey],
    };
  }

  async assertCanCreateNode(user: string, parent: string | null, typeKey: string): Promise<void> { await this.assert(user, 'node.create', parent, { parentNodeId: parent, nodeTypeKey: typeKey }); }
  async assertCanMoveNode(user: string, node: string, parent: string | null): Promise<void> { await this.assert(user, 'node.move', node, { nodeId: node }); if (parent) await this.assert(user, 'node.create', parent, { newParentId: parent }); }
  async assertCanReadNode(user: string, node: string | null): Promise<void> { await this.assert(user, 'node.read', node, { nodeId: node }); }
  async listReadableResourceIds(user: string, domain: TypeDomain, resourceIds: readonly string[]): Promise<string[]> {
    const ids = [...new Set(resourceIds)];
    if (ids.length === 0) return [];
    const permission = domain === 'node' ? 'node.read' : 'entity.read';
    const source = domain === 'node'
      ? 'nodes resource JOIN nodes target ON target.id=resource.id'
      : 'entities resource JOIN nodes target ON target.id=resource.parent_node_id';
    const acl = AccessControlPortSqlite.getReadAccessControlSql('target', user, permission);
    return this.database.all<{ id: string }>(
      `SELECT resource.id FROM ${source}
       WHERE resource.id IN (${ids.map(() => '?').join(',')}) AND resource.deleted_at IS NULL AND target.deleted_at IS NULL
         AND ${acl.sql}`,
      [...ids, ...acl.values],
    ).map((row) => row.id);
  }
  async assertCanCreateEntity(user: string, parent: string, typeKey: string): Promise<void> { await this.assert(user, 'entity.create', parent, { parentNodeId: parent, entityTypeKey: typeKey }); }
  async assertCanEditEntity(user: string, entity: string): Promise<void> { await this.assertEntity(user, 'entity.edit', entity); }
  async assertCanDeleteEntity(user: string, entity: string): Promise<void> { await this.assertEntity(user, 'entity.delete', entity); }
  async assertCanMoveEntity(user: string, entity: string, parent: string): Promise<void> { await this.assertEntity(user, 'entity.move', entity); await this.assert(user, 'entity.create', parent, { newParentId: parent }); }
  async assertHasPermission(user: string, permission: string, node: string | null): Promise<void> { await this.assert(user, permission, node, { permissionKey: permission, nodeId: node }); }
  async assertHasPermissionCoverage(user: string, permission: string, node: string, propagation: 'self' | 'subtree'): Promise<void> {
    if (propagation === 'self') return this.assertHasPermission(user, permission, node);
    const allowed = await this.hasPermission(user, permission, node, 'subtree');
    if (!allowed) throw new ForbiddenError(`User '${user}' lacks subtree permission '${permission}'.`, { user, permission, node, propagation });
  }
  async assertHasPermissionCoverageBatch(user: string, permissions: readonly string[], node: string, propagation: 'self' | 'subtree'): Promise<void> { for (const permission of new Set(permissions)) await this.assertHasPermissionCoverage(user, permission, node, propagation); }
  async assertIsSuperAdmin(user: string): Promise<void> { const row = this.database.get('SELECT 1 FROM users WHERE id=? AND is_active=1 AND is_super_admin=1', [user]); if (!row) throw new ForbiddenError('Only Super Admins can alter the global permission model.', { actorUserId: user }); }

  async canAccessNodeIncludingDeleted(user: string, permission: string, node: string): Promise<boolean> {
    const identity = this.database.get<{ is_super_admin: number }>('SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL', [user]);
    if (!identity) return false;
    if (identity.is_super_admin === 1) return true;
    const target = this.database.get<{ path: string }>('SELECT path FROM nodes WHERE id=?', [node]);
    const permissionRow = this.database.get<{ id: string }>('SELECT id FROM permissions WHERE permission_key=?', [permission]);
    if (!target || !permissionRow) return false;
    const matches = (effect: 'allow' | 'deny') => this.database.get(
      `SELECT 1
       FROM node_scope_assignments assignment
       JOIN role_permissions role_permission ON role_permission.role_id=assignment.role_id
       JOIN nodes assigned_node ON assigned_node.id=assignment.node_id
       WHERE assignment.user_id=? AND role_permission.permission_id=? AND assignment.assignment_effect=?
         AND ((assignment.propagation='self' AND assignment.node_id=?)
           OR (assignment.propagation='subtree' AND (?=assigned_node.path OR ? LIKE assigned_node.path || '.%')))
       LIMIT 1`,
      [user, permissionRow.id, effect, node, target.path, target.path],
    ) !== undefined;
    return matches('allow') && !matches('deny');
  }

  async assertHasPermissionIncludingDeleted(user: string, permission: string, node: string): Promise<void> {
    if (!(await this.canAccessNodeIncludingDeleted(user, permission, node))) {
      throw new ForbiddenError(`User '${user}' lacks permission '${permission}' on deleted node '${node}'.`, { actorUserId: user, permissionKey: permission, nodeId: node });
    }
  }

  private async assert(user: string, permission: string, node: string | null, details: Record<string, unknown>): Promise<void> { if (!(await this.hasPermission(user, permission, node))) throw new ForbiddenError(`User '${user}' lacks permission '${permission}'.`, { actorUserId: user, ...details }); }
  private async assertEntity(user: string, permission: string, entity: string): Promise<void> { const row = this.database.get<{ parent_node_id: string }>('SELECT parent_node_id FROM entities WHERE id=? AND deleted_at IS NULL', [entity]); if (!row) throw new ForbiddenError(`Entity '${entity}' was not found or is deleted.`, { actorUserId: user, entityId: entity }); await this.assert(user, permission, row.parent_node_id, { entityId: entity, parentNodeId: row.parent_node_id }); }
  private async hasPermission(user: string, permission: string, node: string | null, requiredPropagation?: 'self' | 'subtree'): Promise<boolean> {
    const identity = this.database.get<{ is_super_admin: number }>('SELECT is_super_admin FROM users WHERE id=? AND is_active=1', [user]);
    if (!identity) return false;
    if (identity.is_super_admin === 1) return true;
    const permissionRow = this.database.get<{ id: string }>('SELECT id FROM permissions WHERE permission_key=?', [permission]);
    if (!permissionRow) return false;
    const global = node === null && this.database.get('SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=? AND rp.permission_id=?', [user, permissionRow.id]);
    if (global) return true;
    if (!node) return false;
    const deny = this.database.get(`SELECT 1 FROM node_scope_assignments a JOIN role_permissions rp ON rp.role_id=a.role_id WHERE a.user_id=? AND rp.permission_id=? AND a.assignment_effect='deny' AND ((a.node_id=? AND a.propagation='self') OR (a.propagation='subtree' AND EXISTS (SELECT 1 FROM node_hierarchy h WHERE h.ancestor_id=a.node_id AND h.descendant_id=?)))`, [user, permissionRow.id, node, node]);
    if (deny) return false;
    const allow = this.database.get(`SELECT 1 FROM node_scope_assignments a JOIN role_permissions rp ON rp.role_id=a.role_id WHERE a.user_id=? AND rp.permission_id=? AND a.assignment_effect='allow' AND ((a.node_id=? AND (? IS NULL OR ?='self' OR a.propagation='subtree')) OR (a.propagation='subtree' AND EXISTS (SELECT 1 FROM node_hierarchy h WHERE h.ancestor_id=a.node_id AND h.descendant_id=?) AND (? IS NULL OR ?='subtree')))`, [user, permissionRow.id, node, requiredPropagation ?? null, requiredPropagation ?? null, node, requiredPropagation ?? null, requiredPropagation ?? null]);
    return !!allow;
  }
}
