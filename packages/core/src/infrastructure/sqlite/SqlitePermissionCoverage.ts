import type { SqliteDatabase } from './SqliteDatabase.js';

/** SQLite translation of the application subtree-delegation coverage contract. */
export function hasSqlitePermissionCoverage(
  database: SqliteDatabase,
  actorUserId: string,
  permissionKey: string,
  nodeId: string,
  propagation: 'self' | 'subtree',
): boolean {
  const identity = database.get<{ is_super_admin: number }>(
    'SELECT is_super_admin FROM users WHERE id=? AND is_active=1 AND deleted_at IS NULL',
    [actorUserId],
  );
  if (!identity) return false;
  if (identity.is_super_admin === 1) return true;
  if (!database.get('SELECT 1 FROM nodes WHERE id=? AND deleted_at IS NULL', [nodeId])) return false;

  const allow = database.get(
    `SELECT 1 FROM node_scope_assignments assignment
       JOIN role_permissions role_permission ON role_permission.role_id=assignment.role_id
       JOIN permissions permission ON permission.id=role_permission.permission_id
      WHERE assignment.user_id=? AND assignment.assignment_effect='allow'
        AND permission.permission_key=?
        AND ((?='self' AND ((assignment.propagation='self' AND assignment.node_id=?)
          OR (assignment.propagation='subtree' AND EXISTS (
            SELECT 1 FROM node_hierarchy hierarchy
             WHERE hierarchy.ancestor_id=assignment.node_id AND hierarchy.descendant_id=?))))
          OR (?='subtree' AND assignment.propagation='subtree' AND EXISTS (
            SELECT 1 FROM node_hierarchy hierarchy
             WHERE hierarchy.ancestor_id=assignment.node_id AND hierarchy.descendant_id=?)))
      LIMIT 1`,
    [actorUserId, permissionKey, propagation, nodeId, nodeId, propagation, nodeId],
  );
  if (!allow) return false;

  const deny = database.get(
    `SELECT 1 FROM node_scope_assignments assignment
       JOIN role_permissions role_permission ON role_permission.role_id=assignment.role_id
       JOIN permissions permission ON permission.id=role_permission.permission_id
      WHERE assignment.user_id=? AND assignment.assignment_effect='deny'
        AND permission.permission_key=?
        AND ((?='self' AND ((assignment.propagation='self' AND assignment.node_id=?)
          OR (assignment.propagation='subtree' AND EXISTS (
            SELECT 1 FROM node_hierarchy hierarchy
             WHERE hierarchy.ancestor_id=assignment.node_id AND hierarchy.descendant_id=?))))
          OR (?='subtree' AND (
            (assignment.propagation='self' AND EXISTS (
              SELECT 1 FROM node_hierarchy hierarchy
               WHERE hierarchy.ancestor_id=? AND hierarchy.descendant_id=assignment.node_id))
            OR (assignment.propagation='subtree' AND (
              EXISTS (SELECT 1 FROM node_hierarchy hierarchy
                       WHERE hierarchy.ancestor_id=? AND hierarchy.descendant_id=assignment.node_id)
              OR EXISTS (SELECT 1 FROM node_hierarchy hierarchy
                          WHERE hierarchy.ancestor_id=assignment.node_id AND hierarchy.descendant_id=?))))))
      LIMIT 1`,
    [actorUserId, permissionKey, propagation, nodeId, nodeId, propagation, nodeId, nodeId, nodeId],
  );
  return !deny;
}
