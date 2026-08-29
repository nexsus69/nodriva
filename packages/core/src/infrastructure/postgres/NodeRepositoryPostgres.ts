import type { DeletedNodeSummary, NodeRepository } from '../../application/ports/NodeRepository.js';
import { Node } from '../../domain/models/Node.js';
import type { PgExecutor } from './PgExecutor.js';
import { NodeNotFoundError, NodePathCollisionError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { LockConflictError } from '../../domain/errors/ApplicationErrors.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import type { FieldEncryptionService } from './FieldEncryptionService.js';

interface NodeRow {
  id: string;
  parent_id: string | null;
  path: string;
  path_label: string;
  depth: number;
  node_type_id: string;
  name: string;
  description: string;
  row_version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  payload: Record<string, unknown>;
}

export class NodeRepositoryPostgres implements NodeRepository {
  constructor(private readonly executor: PgExecutor, private readonly fieldEncryption?: FieldEncryptionService) {}

  async findById(id: string): Promise<Node | null> {
    const query = `
      SELECT id, parent_id, path, path_label, depth, node_type_id,
             name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by, payload
      FROM nodes
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.executor.query<NodeRow>(query, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const node = this.mapToDomain(row);
    return this.fieldEncryption ? this.mapToDomain(row, await this.fieldEncryption.restore('node', row.id, node.payload)) : node;
  }

  async findDeletedById(id: string): Promise<Node | null> {
    const result = await this.executor.query<NodeRow>(`SELECT id, parent_id, path, path_label, depth, node_type_id, name, description, row_version, created_at, updated_at, deleted_at, created_by, updated_by, payload FROM nodes WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
    const row = result.rows[0];
    if (!row) return null;
    const node = this.mapToDomain(row);
    return this.fieldEncryption ? this.mapToDomain(row, await this.fieldEncryption.restore('node', row.id, node.payload)) : node;
  }

  async listDeletedByScope(actorUserId: string, limit = 100, offset = 0): Promise<DeletedNodeSummary[]> {
    const result = await this.executor.query<DeletedNodeSummary>(`
      SELECT n.id, n.node_type_id AS "nodeTypeId", nt.name AS "nodeTypeName",
             n.parent_id AS "parentId", parent.name AS "parentName", n.name,
             n.path::text AS path, n.row_version AS "rowVersion", n.deleted_at AS "deletedAt",
             n.deletion_batch_id AS "deletionBatchId",
             NOT EXISTS (
               SELECT 1 FROM nodes batch_parent
               WHERE batch_parent.id = n.parent_id
                 AND batch_parent.deleted_at IS NOT NULL
                 AND batch_parent.deletion_batch_id = n.deletion_batch_id
             ) AS "isDeletionRoot",
             (SELECT count(*)::int FROM nodes batch_node
              WHERE batch_node.deleted_at IS NOT NULL AND batch_node.deletion_batch_id = n.deletion_batch_id) AS "affectedNodeCount",
             (SELECT count(*)::int FROM entities batch_entity
              WHERE batch_entity.deleted_at IS NOT NULL AND batch_entity.deletion_batch_id = n.deletion_batch_id) AS "affectedEntityCount"
      FROM nodes n
      JOIN node_types nt ON nt.id = n.node_type_id
      LEFT JOIN nodes parent ON parent.id = n.parent_id
      WHERE n.deleted_at IS NOT NULL
        AND ${AccessControlPortPostgres.getReadAccessControlSql('$1', 'n', 'node.restore')}
      ORDER BY n.deleted_at DESC
      LIMIT $2 OFFSET $3`, [actorUserId, limit, offset]);
    return result.rows;
  }

  async listChildren(parentId: string | null, limit?: number, offset?: number): Promise<Node[]> {
    const isRoot = !parentId;
    let query = `
      SELECT id, parent_id, path, path_label, depth, node_type_id,
             name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by, payload
      FROM nodes
      WHERE ${isRoot ? 'parent_id IS NULL' : 'parent_id = $1'} AND deleted_at IS NULL
      ORDER BY path ASC, name ASC
    `;
    const params: unknown[] = isRoot ? [] : [parentId];

    if (limit !== undefined) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    if (offset !== undefined) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }

    const result = await this.executor.query<NodeRow>(query, params);
    return this.restoreNodes(result.rows);
  }

  async listReadableChildren(parentId: string | null, actorUserId: string): Promise<Node[]> {
    const parentClause = parentId ? 'n.parent_id = $1' : 'n.parent_id IS NULL';
    const params: unknown[] = parentId ? [parentId, actorUserId] : [actorUserId];
    const actorParam = parentId ? '$2' : '$1';
    const result = await this.executor.query<NodeRow>(
      `SELECT n.id, n.parent_id, n.path, n.path_label, n.depth, n.node_type_id,
              n.name, n.description, n.row_version, n.created_at, n.updated_at,
              n.deleted_at, n.created_by, n.updated_by, n.payload
       FROM nodes n WHERE ${parentClause} AND n.deleted_at IS NULL
         AND ${AccessControlPortPostgres.getReadAccessControlSql(actorParam, 'n', 'node.read')}
       ORDER BY n.path ASC, n.name ASC`,
      params
    );
    return this.restoreNodes(result.rows);
  }

  async listReadableVirtualRoots(actorUserId: string): Promise<Node[]> {
    const result = await this.executor.query<NodeRow>(
      `SELECT n.id, n.parent_id, n.path, n.path_label, n.depth, n.node_type_id,
              n.name, n.description, n.row_version, n.created_at, n.updated_at,
              n.deleted_at, n.created_by, n.updated_by, n.payload
       FROM nodes n
       WHERE n.deleted_at IS NULL
         AND ${AccessControlPortPostgres.getReadAccessControlSql('$1', 'n', 'node.read')}
         AND (n.parent_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM nodes parent WHERE parent.id = n.parent_id AND parent.deleted_at IS NULL
             AND ${AccessControlPortPostgres.getReadAccessControlSql('$1', 'parent', 'node.read')}
         ))
       ORDER BY n.path ASC, n.name ASC`, [actorUserId]
    );
    return this.restoreNodes(result.rows);
  }

  async create(node: Node): Promise<void> {
    const payload = this.fieldEncryption ? await this.fieldEncryption.protect('node', node.nodeTypeId, node.id, node.payload) : node.payload;
    const query = `
      INSERT INTO nodes (
        id, parent_id, path, path_label, depth, node_type_id,
        name, description, row_version,
        created_at, updated_at, deleted_at, created_by, updated_by, payload
      ) VALUES ($1, $2, $3::ltree, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;
    try {
      await this.executor.query(query, [
        node.id,
        node.parentId,
        node.path,
        node.pathLabel,
        node.depth,
        node.nodeTypeId,
        node.name,
        node.description,
        node.rowVersion,
        node.createdAt,
        node.updatedAt,
        node.deletedAt,
        node.createdBy,
        node.updatedBy,
        payload,
      ]);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === '23505' && Reflect.get(error, 'constraint') === 'uq_nodes_parent_id_path_label_active') {
        throw new NodePathCollisionError(node.parentId, node.pathLabel, error);
      }
      throw error;
    }
  }

  async update(node: Node): Promise<void> {
    const payload = this.fieldEncryption ? await this.fieldEncryption.protect('node', node.nodeTypeId, node.id, node.payload) : node.payload;
    const query = `
      UPDATE nodes
      SET name = $1, description = $2, payload = $3, row_version = $4,
          updated_at = $5, updated_by = $6
      WHERE id = $7 AND row_version = $8 AND deleted_at IS NULL
    `;

    const previousRowVersion = node.rowVersion - 1;
    const result = await this.executor.query(query, [
      node.name,
      node.description,
      payload,
      node.rowVersion,
      node.updatedAt,
      node.updatedBy,
      node.id,
      previousRowVersion,
    ]);

    if (result.rowCount === 0) {
      const checkResult = await this.executor.query<{ row_version: number; deleted_at: Date | null }>(
        'SELECT row_version, deleted_at FROM nodes WHERE id = $1',
        [node.id]
      );
      const checkRow = checkResult.rows[0];
      if (!checkRow || checkRow.deleted_at !== null) {
        throw new NodeNotFoundError(node.id);
      }
      throw new RowVersionMismatchError(previousRowVersion, checkRow.row_version);
    }
  }

  async moveSubtree(nodeId: string, newParentId: string | null, actorUserId: string): Promise<void> {
    // 1. Carichiamo il nodo corrente per ottenere il vecchio path ltree
    const nodeResult = await this.executor.query<NodeRow>(
      `SELECT id, parent_id, path, path_label, depth, node_type_id,
              name, description, row_version,
              created_at, updated_at, deleted_at, created_by, updated_by, payload
       FROM nodes WHERE id = $1 AND deleted_at IS NULL`,
      [nodeId]
    );
    const nodeRow = nodeResult.rows[0];
    if (!nodeRow) {
      throw new NodeNotFoundError(nodeId);
    }

    // 2. Calcoliamo il nuovo path del nodo spostato
    let newParentPath: string | null = null;
    let newDepth: number;

    if (newParentId) {
      const parentResult = await this.executor.query<{ path: string; depth: number }>(
        'SELECT path::text, depth FROM nodes WHERE id = $1 AND deleted_at IS NULL',
        [newParentId]
      );
      const parentRow = parentResult.rows[0];
      if (!parentRow) {
        throw new NodeNotFoundError(newParentId);
      }
      newParentPath = parentRow.path;
      newDepth = parentRow.depth + 1;
    } else {
      newDepth = 0;
    }

    const oldPath = nodeRow.path;
    const newNodePath = newParentPath
      ? `${newParentPath}.${nodeRow.path_label}`
      : nodeRow.path_label;

    const depthDelta = newDepth - nodeRow.depth;

    // 3. Aggiornamento atomico del nodo radice spostato
    await this.executor.query(
      `UPDATE nodes
       SET parent_id = $1, path = $2::ltree, depth = $3,
           updated_at = now(), updated_by = $4,
           row_version = row_version + 1
       WHERE id = $5 AND deleted_at IS NULL`,
      [newParentId, newNodePath, newDepth, actorUserId, nodeId]
    );

    // 4. Aggiornamento ricorsivo di tutti i discendenti tramite ltree subpath
    //    Riscriviamo il prefisso del path e aggiustiamo la depth in modo atomico.
    //    Usiamo l'operatore ltree: subpath(path, nlevel(oldPath)) restituisce il
    //    suffisso del path dopo il vecchio prefisso. Lo accodiamo al newNodePath.
    await this.executor.query(
      `UPDATE nodes
       SET path = ($1::ltree || subpath(path, nlevel($2::ltree)))::ltree,
           depth = depth + $3,
           updated_at = now(), updated_by = $4,
           row_version = row_version + 1
       WHERE path <@ $2::ltree
         AND id != $5
         AND deleted_at IS NULL`,
      [newNodePath, oldPath, depthDelta, actorUserId, nodeId]
    );
  }

  async listSubtree(nodeId: string): Promise<Node[]> {
    const result = await this.executor.query<NodeRow>(
      `SELECT id, parent_id, path, path_label, depth, node_type_id,
              name, description, row_version, created_at, updated_at,
              deleted_at, created_by, updated_by, payload
       FROM nodes
       WHERE path <@ (SELECT path FROM nodes WHERE id = $1)
         AND deleted_at IS NULL
       ORDER BY path ASC`,
      [nodeId]
    );
    return this.restoreNodes(result.rows);
  }

  async existsByParentAndPathLabel(parentId: string | null, pathLabel: string): Promise<boolean> {
    // Sfrutta l'indice parziale uq_nodes_parent_id_path_label_active
    const query = parentId
      ? `SELECT 1 FROM nodes WHERE parent_id = $1 AND path_label = $2 AND deleted_at IS NULL LIMIT 1`
      : `SELECT 1 FROM nodes WHERE parent_id IS NULL AND path_label = $1 AND deleted_at IS NULL LIMIT 1`;

    const params = parentId ? [parentId, pathLabel] : [pathLabel];
    const result = await this.executor.query(query, params);
    return result.rows.length > 0;
  }

  async listAncestorIds(nodeId: string): Promise<string[]> {
    const result = await this.executor.query<{ id: string }>(
      `SELECT ancestor.id
       FROM nodes AS child
       JOIN nodes AS ancestor ON child.path <@ ancestor.path
       WHERE child.id = $1
         AND child.deleted_at IS NULL
         AND ancestor.deleted_at IS NULL
       ORDER BY ancestor.depth DESC, ancestor.id ASC`,
      [nodeId]
    );
    return result.rows.map((row) => row.id);
  }

  async listAncestorIdsForNodes(nodeIds: string[]): Promise<Map<string, string[]>> {
    const uniqueNodeIds = [...new Set(nodeIds)];
    const ancestorsByNode = new Map<string, string[]>();
    if (uniqueNodeIds.length === 0) return ancestorsByNode;

    const result = await this.executor.query<{ node_id: string; ancestor_id: string }>(
      `SELECT child.id AS node_id, ancestor.id AS ancestor_id
       FROM nodes AS child
       JOIN nodes AS ancestor ON child.path <@ ancestor.path
       WHERE child.id = ANY($1::uuid[])
         AND child.deleted_at IS NULL
         AND ancestor.deleted_at IS NULL
       ORDER BY child.id, ancestor.depth DESC, ancestor.id ASC`,
      [uniqueNodeIds]
    );

    for (const nodeId of uniqueNodeIds) ancestorsByNode.set(nodeId, []);
    for (const row of result.rows) {
      ancestorsByNode.get(row.node_id)?.push(row.ancestor_id);
    }
    return ancestorsByNode;
  }

  async isDescendantOf(nodeId: string, potentialAncestorId: string): Promise<boolean> {
    // Strict semantics: a node is NOT considered a descendant of itself.
    if (nodeId === potentialAncestorId) {
      return false;
    }

    // Uses ltree <@ operator: "child.path <@ ancestor.path" means child is a descendant.
    // The GIST index on nodes.path (idx_nodes_path_gist) makes this efficient.
    const query = `
      SELECT 1
      FROM nodes AS child
      JOIN nodes AS ancestor ON ancestor.id = $2
      WHERE child.id = $1
        AND child.path <@ ancestor.path
        AND child.deleted_at IS NULL
        AND ancestor.deleted_at IS NULL
      LIMIT 1
    `;
    const result = await this.executor.query(query, [nodeId, potentialAncestorId]);
    return result.rows.length > 0;
  }

  async getDeletionBatchId(nodeId: string): Promise<string | null> {
    const result = await this.executor.query<{ deletion_batch_id: string | null }>('SELECT deletion_batch_id FROM nodes WHERE id = $1 AND deleted_at IS NOT NULL', [nodeId]);
    return result.rows[0]?.deletion_batch_id ?? null;
  }

  async softDeleteSubtree(nodeId: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<string[]> {
    const result = await this.executor.query<{ id: string }>(
      `WITH root AS (
         SELECT path FROM nodes WHERE id = $1 AND deleted_at IS NULL AND row_version = $2
       ), updated_entities AS (
         UPDATE entities SET deleted_at = now(), deletion_batch_id = $3, row_version = row_version + 1, updated_at = now(), updated_by = $4
         WHERE parent_node_id IN (SELECT n.id FROM nodes n, root WHERE n.path <@ root.path AND n.deleted_at IS NULL) AND deleted_at IS NULL RETURNING id
       )
       UPDATE nodes SET deleted_at = now(), deletion_batch_id = $3, row_version = row_version + 1, updated_at = now(), updated_by = $4
       WHERE path <@ (SELECT path FROM root) AND deleted_at IS NULL RETURNING id`,
      [nodeId, expectedRowVersion, deletionBatchId, actorUserId],
    );
    if (result.rows.length === 0) {
      const current = await this.executor.query<{ row_version: number; deleted_at: Date | null }>('SELECT row_version, deleted_at FROM nodes WHERE id = $1', [nodeId]);
      const row = current.rows[0];
      if (!row || row.deleted_at !== null) throw new NodeNotFoundError(nodeId);
      throw new RowVersionMismatchError(expectedRowVersion, row.row_version);
    }
    return result.rows.map((row) => row.id);
  }

  async assertSubtreeUnlocked(nodeId: string, actorUserId: string): Promise<void> {
    const result = await this.executor.query<{ resource_type: string; resource_id: string }>(`
      SELECT l.resource_type, l.resource_id
      FROM locks l
      JOIN nodes root ON root.id = $1
      WHERE l.expires_at > now()
        AND l.user_id::text <> $2
        AND (
          (l.resource_type = 'node' AND EXISTS (SELECT 1 FROM nodes n WHERE n.id::text = l.resource_id AND n.path <@ root.path))
          OR
          (l.resource_type = 'entity' AND EXISTS (
            SELECT 1 FROM entities e JOIN nodes parent ON parent.id = e.parent_node_id
            WHERE e.id::text = l.resource_id AND parent.path <@ root.path
          ))
        )
      ORDER BY l.expires_at ASC
      LIMIT 1`, [nodeId, actorUserId]);
    const conflict = result.rows[0];
    if (conflict) throw new LockConflictError(conflict.resource_type, conflict.resource_id);
  }

  async restoreSubtree(nodeId: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<string[]> {
    const root = await this.executor.query<{ id: string }>(
      'SELECT id FROM nodes WHERE id = $1 AND deleted_at IS NOT NULL AND deletion_batch_id = $3 AND row_version = $2',
      [nodeId, expectedRowVersion, deletionBatchId],
    );
    if (root.rows.length === 0) {
      const current = await this.executor.query<{ row_version: number; deleted_at: Date | null; deletion_batch_id: string | null }>(
        'SELECT row_version, deleted_at, deletion_batch_id FROM nodes WHERE id = $1', [nodeId],
      );
      const row = current.rows[0];
      if (!row || row.deleted_at === null || row.deletion_batch_id !== deletionBatchId) throw new NodeNotFoundError(nodeId);
      throw new RowVersionMismatchError(expectedRowVersion, row.row_version);
    }

    // The batch is the immutable membership set of the deleted subtree. No
    // recursive traversal is needed during restore, and independently deleted
    // resources are excluded because they carry a different/null batch id.
    await this.executor.query(
      `UPDATE entities SET deleted_at = NULL, deletion_batch_id = NULL, row_version = row_version + 1, updated_at = now(), updated_by = $2
       WHERE deleted_at IS NOT NULL AND deletion_batch_id = $1`,
      [deletionBatchId, actorUserId],
    );
    const result = await this.executor.query<{ id: string }>(
      `UPDATE nodes SET deleted_at = NULL, deletion_batch_id = NULL, row_version = row_version + 1, updated_at = now(), updated_by = $2
       WHERE deleted_at IS NOT NULL AND deletion_batch_id = $1 RETURNING id`,
      [deletionBatchId, actorUserId],
    );
    return result.rows.map((row) => row.id);
  }

  private mapToDomain(row: NodeRow, payload = row.payload ?? {}): Node {
    return new Node(
      row.id,
      row.parent_id,
      row.path,
      row.path_label,
      row.depth,
      row.node_type_id,
      row.name,
      row.description,
      row.row_version,
      row.created_at,
      row.updated_at,
      row.deleted_at,
      row.created_by,
      row.updated_by,
      payload
    );
  }

  private async restoreNodes(rows: readonly NodeRow[]): Promise<Node[]> {
    return Promise.all(rows.map(async (row) => {
      const node = this.mapToDomain(row);
      return this.fieldEncryption ? this.mapToDomain(row, await this.fieldEncryption.restore('node', row.id, node.payload)) : node;
    }));
  }
}
