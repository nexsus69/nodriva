import { NodeRepository } from '../../application/ports/NodeRepository.js';
import { Node } from '../../domain/models/Node.js';
import { PgExecutor } from './PgExecutor.js';
import { NodeNotFoundError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';

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
}

export class NodeRepositoryPostgres implements NodeRepository {
  constructor(private readonly executor: PgExecutor) {}

  async findById(id: string): Promise<Node | null> {
    const query = `
      SELECT id, parent_id, path, path_label, depth, node_type_id,
             name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by
      FROM nodes
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.executor.query<NodeRow>(query, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapToDomain(row);
  }

  async listChildren(parentId: string | null, limit?: number, offset?: number): Promise<Node[]> {
    const isRoot = !parentId;
    let query = `
      SELECT id, parent_id, path, path_label, depth, node_type_id,
             name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by
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
    return result.rows.map((row) => this.mapToDomain(row));
  }

  async create(node: Node): Promise<void> {
    const query = `
      INSERT INTO nodes (
        id, parent_id, path, path_label, depth, node_type_id,
        name, description, row_version,
        created_at, updated_at, deleted_at, created_by, updated_by
      ) VALUES ($1, $2, $3::ltree, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
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
    ]);
  }

  async update(node: Node): Promise<void> {
    const query = `
      UPDATE nodes
      SET name = $1, description = $2, row_version = $3,
          updated_at = $4, updated_by = $5
      WHERE id = $6 AND row_version = $7 AND deleted_at IS NULL
    `;

    const previousRowVersion = node.rowVersion - 1;
    const result = await this.executor.query(query, [
      node.name,
      node.description,
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
              created_at, updated_at, deleted_at, created_by, updated_by
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

  private mapToDomain(row: NodeRow): Node {
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
      row.updated_by
    );
  }
}
