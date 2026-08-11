import { AccessControlPort } from '../../application/ports/AccessControlPort.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import { PgExecutor } from './PgExecutor.js';

/**
 * Adapter PostgreSQL per il controllo degli accessi gerarchico ed ACL (Access Control List).
 * Implementa AccessControlPort consultando le tabelle di utenti, ruoli, permessi e
 * assegnazioni di scope sui nodi (node_scope_assignments) con supporto ltree.
 */
export class AccessControlPortPostgres implements AccessControlPort {
  constructor(private readonly executor: PgExecutor) {}

  /**
   * Generates the SQL snippet for Read Access Control to be injected into Query Ports.
   * Assumes the target node table is aliased as `nodeAlias` (default 'n') and its path column is `path`.
   * 
   * The PostgreSQL adapter reads the materialized `node_path` held by each
   * assignment. Migration 004 keeps that value in sync with `nodes.path`, so
   * subtree predicates do not need a correlated node lookup per record.
   */
  static getReadAccessControlSql(
    actorIdParam: string,
    nodeAlias: string = 'n',
    readPermissionKey: string = 'node.read'
  ): string {
    const escapedPermissionKey = readPermissionKey.replace(/'/g, "''");
    return `
      (
        -- 1. SuperAdmin is absolute and cannot be shadowed by local deny rows.
        EXISTS (SELECT 1 FROM users u WHERE u.id = ${actorIdParam} AND u.is_active = true AND u.is_super_admin = true)
        OR (
        -- 2. Local Read Permission (Allow); node.read is always scope-bound
        EXISTS (
          SELECT 1 FROM node_scope_assignments nsa
          JOIN role_permissions rp ON nsa.role_id = rp.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE nsa.user_id = ${actorIdParam}
            AND EXISTS (SELECT 1 FROM users u WHERE u.id = ${actorIdParam} AND u.is_active = true)
            AND p.permission_key = '${escapedPermissionKey}'
            AND nsa.assignment_effect = 'allow'::assignment_effect_enum
            AND (
              (nsa.propagation = 'self'::scope_propagation_enum AND nsa.node_id = ${nodeAlias}.id)
              OR 
              (nsa.propagation = 'subtree'::scope_propagation_enum AND nsa.node_path @> ${nodeAlias}.path)
            )
        )
        -- 3. DENY Overrides local Allow
        AND NOT EXISTS (
        SELECT 1 FROM node_scope_assignments nsa
        JOIN role_permissions rp ON nsa.role_id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE nsa.user_id = ${actorIdParam}
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = ${actorIdParam} AND u.is_active = true)
          AND p.permission_key = '${escapedPermissionKey}'
          AND nsa.assignment_effect = 'deny'::assignment_effect_enum
          AND (
            (nsa.propagation = 'self'::scope_propagation_enum AND nsa.node_id = ${nodeAlias}.id)
            OR 
            (nsa.propagation = 'subtree'::scope_propagation_enum AND nsa.node_path @> ${nodeAlias}.path)
          )
        ))
      )
    `;
  }

  async assertCanCreateNode(
    actorUserId: string,
    parentNodeId: string | null,
    nodeTypeKey: string
  ): Promise<void> {
    const isAllowed = await this.hasPermission(actorUserId, 'node.create', parentNodeId);
    if (!isAllowed) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'node.create' on node '${parentNodeId ?? 'root'}'.`,
        { actorUserId, parentNodeId, nodeTypeKey }
      );
    }
  }

  async assertCanMoveNode(
    actorUserId: string,
    nodeId: string,
    newParentId: string | null
  ): Promise<void> {
    // Muovere un nodo richiede 'node.move' sul nodo stesso
    const canMoveNode = await this.hasPermission(actorUserId, 'node.move', nodeId);
    if (!canMoveNode) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'node.move' on node '${nodeId}'.`,
        { actorUserId, nodeId }
      );
    }

    // Se spostato sotto un nuovo parent, richiede anche 'node.create' sul nuovo parent
    if (newParentId) {
      const canCreateUnderParent = await this.hasPermission(actorUserId, 'node.create', newParentId);
      if (!canCreateUnderParent) {
        throw new ForbiddenError(
          `User '${actorUserId}' does not have permission 'node.create' under new parent node '${newParentId}'.`,
          { actorUserId, newParentId }
        );
      }
    }
  }

  async assertCanReadNode(actorUserId: string, nodeId: string | null): Promise<void> {
    const isAllowed = await this.hasPermission(actorUserId, 'node.read', nodeId);
    if (!isAllowed) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'node.read' on node '${nodeId ?? 'root'}'.`,
        { actorUserId, nodeId }
      );
    }
  }

  async assertCanCreateEntity(
    actorUserId: string,
    parentNodeId: string,
    entityTypeKey: string
  ): Promise<void> {
    const isAllowed = await this.hasPermission(actorUserId, 'entity.create', parentNodeId);
    if (!isAllowed) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'entity.create' on node '${parentNodeId}'.`,
        { actorUserId, parentNodeId, entityTypeKey }
      );
    }
  }

  async assertCanEditEntity(actorUserId: string, entityId: string): Promise<void> {
    // 1. Risolviamo il parent_node_id dell'entità
    const queryParent = `
      SELECT parent_node_id FROM entities WHERE id = $1 AND deleted_at IS NULL
    `;
    const resultParent = await this.executor.query<{ parent_node_id: string }>(queryParent, [entityId]);
    const rowParent = resultParent.rows[0];

    if (!rowParent) {
      throw new ForbiddenError(`Entity '${entityId}' was not found or is deleted.`, { actorUserId, entityId });
    }

    // 2. Verifica del permesso 'entity.edit' sul nodo genitore
    const isAllowed = await this.hasPermission(actorUserId, 'entity.edit', rowParent.parent_node_id);
    if (!isAllowed) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'entity.edit' on parent node '${rowParent.parent_node_id}'.`,
        { actorUserId, entityId, parentNodeId: rowParent.parent_node_id }
      );
    }
  }

  async assertCanDeleteEntity(actorUserId: string, entityId: string): Promise<void> {
    const result = await this.executor.query<{ parent_node_id: string }>(
      'SELECT parent_node_id FROM entities WHERE id = $1 AND deleted_at IS NULL',
      [entityId]
    );
    const parentNodeId = result.rows[0]?.parent_node_id;
    if (!parentNodeId) {
      throw new ForbiddenError(`Entity '${entityId}' was not found or is deleted.`, { actorUserId, entityId });
    }

    const isAllowed = await this.hasPermission(actorUserId, 'entity.delete', parentNodeId);
    if (!isAllowed) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'entity.delete' on parent node '${parentNodeId}'.`,
        { actorUserId, entityId, parentNodeId }
      );
    }
  }

  async assertCanMoveEntity(actorUserId: string, entityId: string, newParentNodeId: string): Promise<void> {
    // 1. Resolve entity's current parent node
    const queryParent = `
      SELECT parent_node_id FROM entities WHERE id = $1 AND deleted_at IS NULL
    `;
    const resultParent = await this.executor.query<{ parent_node_id: string }>(queryParent, [entityId]);
    const rowParent = resultParent.rows[0];

    if (!rowParent) {
      throw new ForbiddenError(`Entity '${entityId}' was not found or is deleted.`, { actorUserId, entityId });
    }

    // 2. Check 'entity.move' on the current parent node
    const canMoveEntity = await this.hasPermission(actorUserId, 'entity.move', rowParent.parent_node_id);
    if (!canMoveEntity) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'entity.move' on parent node '${rowParent.parent_node_id}'.`,
        { actorUserId, entityId, parentNodeId: rowParent.parent_node_id }
      );
    }

    // 3. Check 'entity.create' on the new parent node
    const canCreateUnderNewParent = await this.hasPermission(actorUserId, 'entity.create', newParentNodeId);
    if (!canCreateUnderNewParent) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission 'entity.create' under new parent node '${newParentNodeId}'.`,
        { actorUserId, newParentNodeId }
      );
    }
  }

  async assertHasPermission(actorUserId: string, permissionKey: string, nodeId: string | null): Promise<void> {
    const isAllowed = await this.hasPermission(actorUserId, permissionKey, nodeId);
    if (!isAllowed) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have permission '${permissionKey}' on scope '${nodeId ?? 'global'}'.`,
        { actorUserId, permissionKey, nodeId }
      );
    }
  }

  async assertHasPermissionCoverage(
    actorUserId: string,
    permissionKey: string,
    nodeId: string,
    propagation: 'self' | 'subtree'
  ): Promise<void> {
    if (propagation === 'self') {
      return this.assertHasPermission(actorUserId, permissionKey, nodeId);
    }

    const result = await this.executor.query(
      `SELECT 1
       FROM users actor
       INNER JOIN nodes target ON target.id = $3 AND target.deleted_at IS NULL
       WHERE actor.id = $1
         AND actor.is_active = true
         AND (
           actor.is_super_admin = true
           OR (
           EXISTS (
             SELECT 1
             FROM node_scope_assignments allow_assignment
             INNER JOIN role_permissions rp ON rp.role_id = allow_assignment.role_id
             INNER JOIN permissions permission ON permission.id = rp.permission_id
             WHERE allow_assignment.user_id = $1
               AND allow_assignment.assignment_effect = 'allow'::assignment_effect_enum
               AND allow_assignment.propagation = 'subtree'::scope_propagation_enum
               AND permission.permission_key = $2
               AND allow_assignment.node_path @> target.path
           )
           AND NOT EXISTS (
           SELECT 1
           FROM node_scope_assignments deny_assignment
           INNER JOIN role_permissions rp ON rp.role_id = deny_assignment.role_id
           INNER JOIN permissions permission ON permission.id = rp.permission_id
           WHERE deny_assignment.user_id = $1
             AND deny_assignment.assignment_effect = 'deny'::assignment_effect_enum
             AND permission.permission_key = $2
             AND (
               (deny_assignment.propagation = 'self'::scope_propagation_enum
                 AND target.path @> deny_assignment.node_path)
               OR
               (deny_assignment.propagation = 'subtree'::scope_propagation_enum
                 AND (target.path @> deny_assignment.node_path OR deny_assignment.node_path @> target.path))
             )
           ))
         )
       LIMIT 1`,
      [actorUserId, permissionKey, nodeId]
    );

    if (result.rows.length === 0) {
      throw new ForbiddenError(
        `User '${actorUserId}' does not have delegable '${permissionKey}' permission on subtree '${nodeId}'.`,
        { actorUserId, permissionKey, nodeId, propagation }
      );
    }
  }

  async assertHasPermissionCoverageBatch(
    actorUserId: string,
    permissionKeys: readonly string[],
    nodeId: string,
    propagation: 'self' | 'subtree'
  ): Promise<void> {
    const uniqueKeys = [...new Set(permissionKeys)];
    if (uniqueKeys.length === 0) return;
    if (propagation === 'self') {
      const result = await this.executor.query<{ permission_key: string }>(
        `SELECT required.permission_key
         FROM unnest($2::text[]) AS required(permission_key)
         WHERE NOT EXISTS (
           SELECT 1 FROM users actor
           WHERE actor.id = $1 AND actor.is_active = true
             AND (actor.is_super_admin = true OR (
               EXISTS (
                 SELECT 1 FROM node_scope_assignments allow_assignment
                 JOIN role_permissions rp ON rp.role_id = allow_assignment.role_id
                 JOIN permissions p ON p.id = rp.permission_id
                 JOIN nodes target ON target.id = $3 AND target.deleted_at IS NULL
                 WHERE allow_assignment.user_id = $1
                   AND allow_assignment.assignment_effect = 'allow'::assignment_effect_enum
                   AND p.permission_key = required.permission_key
                   AND (allow_assignment.node_id = target.id
                     OR (allow_assignment.propagation = 'subtree'::scope_propagation_enum
                       AND allow_assignment.node_path @> target.path))
               )
               AND NOT EXISTS (
                 SELECT 1 FROM node_scope_assignments deny_assignment
                 JOIN role_permissions rp ON rp.role_id = deny_assignment.role_id
                 JOIN permissions p ON p.id = rp.permission_id
                 JOIN nodes target ON target.id = $3 AND target.deleted_at IS NULL
                 WHERE deny_assignment.user_id = $1
                   AND deny_assignment.assignment_effect = 'deny'::assignment_effect_enum
                   AND p.permission_key = required.permission_key
                   AND (deny_assignment.node_id = target.id
                     OR (deny_assignment.propagation = 'subtree'::scope_propagation_enum
                       AND deny_assignment.node_path @> target.path))
               )
             ))
         )`,
        [actorUserId, uniqueKeys, nodeId]
      );
      if (result.rows.length === 0) return;
      throw new ForbiddenError(
        `User '${actorUserId}' cannot delegate every required permission on node '${nodeId}'.`,
        { actorUserId, nodeId, propagation, missingPermissionKeys: result.rows.map((row) => row.permission_key) }
      );
    }

    const result = await this.executor.query<{ permission_key: string }>(
      `SELECT required.permission_key
       FROM unnest($2::text[]) AS required(permission_key)
       WHERE NOT EXISTS (
         SELECT 1
         FROM users actor
         JOIN nodes target ON target.id = $3 AND target.deleted_at IS NULL
         WHERE actor.id = $1 AND actor.is_active = true
           AND (actor.is_super_admin = true OR (
             EXISTS (
               SELECT 1 FROM node_scope_assignments allow_assignment
               JOIN role_permissions rp ON rp.role_id = allow_assignment.role_id
               JOIN permissions p ON p.id = rp.permission_id
               WHERE allow_assignment.user_id = $1
                 AND allow_assignment.assignment_effect = 'allow'::assignment_effect_enum
                 AND allow_assignment.propagation = 'subtree'::scope_propagation_enum
                 AND allow_assignment.node_path @> target.path
                 AND p.permission_key = required.permission_key
             )
             AND NOT EXISTS (
               SELECT 1 FROM node_scope_assignments deny_assignment
               JOIN role_permissions rp ON rp.role_id = deny_assignment.role_id
               JOIN permissions p ON p.id = rp.permission_id
               WHERE deny_assignment.user_id = $1
                 AND deny_assignment.assignment_effect = 'deny'::assignment_effect_enum
                 AND p.permission_key = required.permission_key
                 AND ((deny_assignment.propagation = 'self'::scope_propagation_enum
                       AND target.path @> deny_assignment.node_path)
                   OR (deny_assignment.propagation = 'subtree'::scope_propagation_enum
                       AND (target.path @> deny_assignment.node_path OR deny_assignment.node_path @> target.path)))
             )
           ))
       )`,
      [actorUserId, uniqueKeys, nodeId]
    );
    if (result.rows.length === 0) return;
    throw new ForbiddenError(
      `User '${actorUserId}' cannot delegate every required permission on subtree '${nodeId}'.`,
      { actorUserId, nodeId, propagation, missingPermissionKeys: result.rows.map((row) => row.permission_key) }
    );
  }

  async assertIsSuperAdmin(actorUserId: string): Promise<void> {
    const result = await this.executor.query(
      'SELECT 1 FROM users WHERE id = $1 AND is_active = true AND is_super_admin = true LIMIT 1',
      [actorUserId]
    );
    if (result.rows.length === 0) {
      throw new ForbiddenError('Only Super Admins can alter the global permission model.', { actorUserId });
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────

  /**
   * Verifica se un utente ha un determinato permesso globale o assegnato a livello di nodo/sottoalbero.
   * Rispetta la regola "Deny overrides Allow" e "Default Deny".
   */
  private async hasPermission(
    userId: string,
    permissionName: string,
    nodeId: string | null
  ): Promise<boolean> {
    // A permission evaluated against a concrete node is always local to that
    // node/sottoalbero. This is essential for delegation operations such as
    // scope.assign: a global administrative grant must not silently turn into
    // authority over every subtree when the caller intended a local scope.
    // Calls with nodeId = null remain explicit global operations.
    const isScopeBoundPermission = nodeId !== null;
    // 1. Super-admin is an unconditional active-identity bypass.
    const superAdmin = await this.executor.query(
      'SELECT 1 FROM users WHERE id = $1 AND is_active = true AND is_super_admin = true LIMIT 1',
      [userId]
    );
    if (superAdmin.rows.length > 0) return true;

    // 2. Se abbiamo un nodeId, controlliamo prima se c'è un DENY esplicito locale o ereditato
    if (nodeId) {
      const denyQuery = `
        SELECT 1
        FROM node_scope_assignments nsa
        JOIN role_permissions rp ON rp.role_id = nsa.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE nsa.user_id = $1
          AND (p.permission_key = $2 OR p.name = $2)
          AND nsa.assignment_effect = 'deny'::assignment_effect_enum
          AND (
            nsa.node_id = $3
            OR
            (nsa.propagation = 'subtree'::scope_propagation_enum AND nsa.node_path @> (
              SELECT path FROM nodes WHERE id = $3 LIMIT 1
            ))
          )
        LIMIT 1
      `;
      const denyResult = await this.executor.query(denyQuery, [userId, permissionName, nodeId]);
      if (denyResult.rows.length > 0) {
        return false; // Deny overrides Allow
      }
    }

    // 3. Global role permissions. I permessi su nodi ed entità restano sempre
    // scope-bound anche quando il ruolo è assegnato all'utente globalmente.
    const globalQuery = `
      SELECT 1
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1 AND u.is_active = true
        AND (NOT $3 AND (p.permission_key = $2 OR p.name = $2))
      LIMIT 1
    `;
    const globalResult = await this.executor.query(globalQuery, [userId, permissionName, isScopeBoundPermission]);
    if (globalResult.rows.length > 0) {
      return true;
    }

    // 4. Controllo permesso assegnato localmente (se nodeId fornito)
    if (nodeId) {
      const localQuery = `
        SELECT 1
        FROM node_scope_assignments nsa
        JOIN role_permissions rp ON rp.role_id = nsa.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE nsa.user_id = $1
          AND (p.permission_key = $2 OR p.name = $2)
          AND nsa.assignment_effect = 'allow'::assignment_effect_enum
          AND (
            nsa.node_id = $3
            OR
            (nsa.propagation = 'subtree'::scope_propagation_enum AND nsa.node_path @> (
              SELECT path FROM nodes WHERE id = $3 LIMIT 1
            ))
          )
        LIMIT 1
      `;
      const localResult = await this.executor.query(localQuery, [userId, permissionName, nodeId]);
      if (localResult.rows.length > 0) {
        return true;
      }
    }

    return false; // Default Deny
  }
}
