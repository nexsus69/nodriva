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
   * @tradeoff NOTA ARCHITETTURALE: Questo snippet esegue una subquery ricorsiva su `nodes` 
   * per determinare il parent path degli scope assignments. Su DB di grandi dimensioni 
   * può innescare problemi di performance (Nested Loop vs Table Scan). L'ottimizzazione è
   * stata consapevolmente rinviata a fasi successive a favore di un Single Source of Truth puro.
   * Per dettagli, possibili rimedi e metriche da monitorare, vedere: `docs/known-tradeoffs.md`.
   */
  static getReadAccessControlSql(actorIdParam: string, nodeAlias: string = 'n'): string {
    return `
      (
        -- 1. SuperAdmin
        EXISTS (SELECT 1 FROM users u WHERE u.id = ${actorIdParam} AND u.is_super_admin = true)
        OR
        -- 2. Global Read Permission
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN role_permissions rp ON ur.role_id = rp.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = ${actorIdParam} AND p.permission_key = 'node.read'
        )
        OR
        -- 3. Local Read Permission (Allow)
        EXISTS (
          SELECT 1 FROM node_scope_assignments nsa
          JOIN role_permissions rp ON nsa.role_id = rp.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE nsa.user_id = ${actorIdParam}
            AND p.permission_key = 'node.read'
            AND nsa.assignment_effect = 'allow'::assignment_effect_enum
            AND (
              (nsa.propagation = 'self'::scope_propagation_enum AND nsa.node_id = ${nodeAlias}.id)
              OR 
              (nsa.propagation = 'subtree'::scope_propagation_enum AND (SELECT path FROM nodes WHERE id = nsa.node_id LIMIT 1) @> ${nodeAlias}.path)
            )
        )
      )
      -- 4. DENY Overrides Allow
      AND NOT EXISTS (
        SELECT 1 FROM node_scope_assignments nsa
        JOIN role_permissions rp ON nsa.role_id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE nsa.user_id = ${actorIdParam}
          AND p.permission_key = 'node.read'
          AND nsa.assignment_effect = 'deny'::assignment_effect_enum
          AND (
            (nsa.propagation = 'self'::scope_propagation_enum AND nsa.node_id = ${nodeAlias}.id)
            OR 
            (nsa.propagation = 'subtree'::scope_propagation_enum AND (SELECT path FROM nodes WHERE id = nsa.node_id LIMIT 1) @> ${nodeAlias}.path)
          )
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
    // 1. Se abbiamo un nodeId, controlliamo prima se c'è un DENY esplicito locale o ereditato
    if (nodeId) {
      const denyQuery = `
        SELECT 1
        FROM node_scope_assignments nsa
        JOIN nodes n ON nsa.node_id = n.id
        JOIN role_permissions rp ON rp.role_id = nsa.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE nsa.user_id = $1
          AND (p.permission_key = $2 OR p.name = $2)
          AND nsa.assignment_effect = 'deny'::assignment_effect_enum
          AND (
            n.id = $3
            OR
            (nsa.propagation = 'subtree'::scope_propagation_enum AND n.path @> (
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

    // 2. Controllo permesso globale o super admin
    const globalQuery = `
      SELECT 1
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1 AND u.is_active = true
        AND (u.is_super_admin = true OR p.permission_key = $2 OR p.name = $2)
      LIMIT 1
    `;
    const globalResult = await this.executor.query(globalQuery, [userId, permissionName]);
    if (globalResult.rows.length > 0) {
      return true;
    }

    // 3. Controllo permesso assegnato localmente (se nodeId fornito)
    if (nodeId) {
      const localQuery = `
        SELECT 1
        FROM node_scope_assignments nsa
        JOIN nodes n ON nsa.node_id = n.id
        JOIN role_permissions rp ON rp.role_id = nsa.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE nsa.user_id = $1
          AND (p.permission_key = $2 OR p.name = $2)
          AND nsa.assignment_effect = 'allow'::assignment_effect_enum
          AND (
            n.id = $3
            OR
            (nsa.propagation = 'subtree'::scope_propagation_enum AND n.path @> (
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
