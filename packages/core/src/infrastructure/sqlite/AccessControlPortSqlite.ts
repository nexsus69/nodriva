import type { AccessControlPort } from '../../application/ports/AccessControlPort.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class AccessControlPortSqlite implements AccessControlPort {
  constructor(private readonly database: SqliteDatabase) {}

  async assertCanCreateNode(user: string, parent: string | null, typeKey: string): Promise<void> { await this.assert(user, 'node.create', parent, { parentNodeId: parent, nodeTypeKey: typeKey }); }
  async assertCanMoveNode(user: string, node: string, parent: string | null): Promise<void> { await this.assert(user, 'node.move', node, { nodeId: node }); if (parent) await this.assert(user, 'node.create', parent, { newParentId: parent }); }
  async assertCanReadNode(user: string, node: string | null): Promise<void> { await this.assert(user, 'node.read', node, { nodeId: node }); }
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

  private async assert(user: string, permission: string, node: string | null, details: Record<string, unknown>): Promise<void> { if (!(await this.hasPermission(user, permission, node))) throw new ForbiddenError(`User '${user}' lacks permission '${permission}'.`, { actorUserId: user, ...details }); }
  private async assertEntity(user: string, permission: string, entity: string): Promise<void> { const row = this.database.get<{ parent_node_id: string }>('SELECT parent_node_id FROM entities WHERE id=? AND deleted_at IS NULL', [entity]); if (!row) throw new ForbiddenError(`Entity '${entity}' was not found or is deleted.`, { actorUserId: user, entityId: entity }); await this.assert(user, permission, row.parent_node_id, { entityId: entity, parentNodeId: row.parent_node_id }); }
  private async hasPermission(user: string, permission: string, node: string | null, requiredPropagation?: 'self' | 'subtree'): Promise<boolean> {
    const identity = this.database.get<{ is_super_admin: number }>('SELECT is_super_admin FROM users WHERE id=? AND is_active=1', [user]);
    if (!identity) return false;
    if (identity.is_super_admin === 1) return true;
    const permissionRow = this.database.get<{ id: string }>('SELECT id FROM permissions WHERE permission_key=? OR name=?', [permission, permission]);
    if (!permissionRow) return false;
    const global = node === null && this.database.get('SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=? AND rp.permission_id=?', [user, permissionRow.id]);
    if (global) return true;
    if (!node) return false;
    const deny = this.database.get(`SELECT 1 FROM node_scope_assignments a JOIN role_permissions rp ON rp.role_id=a.role_id WHERE a.user_id=? AND rp.permission_id=? AND a.assignment_effect='deny' AND ((a.node_id=? AND a.propagation='self') OR (a.propagation='subtree' AND EXISTS (SELECT 1 FROM node_hierarchy h WHERE h.ancestor_id=a.node_id AND h.descendant_id=?)))`, [user, permissionRow.id, node, node]);
    if (deny) return false;
    const allow = this.database.get(`SELECT 1 FROM node_scope_assignments a JOIN role_permissions rp ON rp.role_id=a.role_id WHERE a.user_id=? AND rp.permission_id=? AND a.assignment_effect='allow' AND (? IS NULL OR (a.node_id=? AND (a.propagation='self' OR ?='subtree')) OR (a.propagation='subtree' AND EXISTS (SELECT 1 FROM node_hierarchy h WHERE h.ancestor_id=a.node_id AND h.descendant_id=?)))`, [user, permissionRow.id, requiredPropagation ?? null, node, requiredPropagation ?? null, node]);
    return !!allow;
  }
}
