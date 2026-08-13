import type { NodeRepository, DeletedNodeSummary } from '../../application/ports/NodeRepository.js';
import { Node } from '../../domain/models/Node.js';
import { NodeNotFoundError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { ForbiddenError, LockConflictError } from '../../domain/errors/ApplicationErrors.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import type { AccessControlPort } from '../../application/ports/AccessControlPort.js';

interface NodeRow { id: string; parent_id: string | null; path: string; path_label: string; depth: number; node_type_id: string; name: string; description: string; row_version: number; created_at: string; updated_at: string; deleted_at: string | null; created_by: string | null; updated_by: string | null; payload: string; deletion_batch_id: string | null; }

/** SQLite node repository. Hierarchy queries use parent_id and recursive CTEs, not ltree. */
export class NodeRepositorySqlite implements NodeRepository {
  constructor(private readonly database: SqliteDatabase, private readonly accessControl?: AccessControlPort) {}

  async findById(id: string): Promise<Node | null> { return this.find(id, false); }
  async findDeletedById(id: string): Promise<Node | null> { return this.find(id, true); }

  async listChildren(parentId: string | null, limit?: number, offset?: number): Promise<Node[]> {
    const clauses = parentId === null ? 'parent_id IS NULL' : 'parent_id = ?';
    const params: unknown[] = parentId === null ? [] : [parentId];
    let sql = `SELECT * FROM nodes WHERE ${clauses} AND deleted_at IS NULL ORDER BY path, name`;
    if (limit !== undefined) { sql += ' LIMIT ?'; params.push(limit); }
    if (offset !== undefined) { sql += ' OFFSET ?'; params.push(offset); }
    return this.database.all<NodeRow>(sql, params).map((row) => this.map(row));
  }

  async listReadableVirtualRoots(actorUserId: string): Promise<Node[]> {
    const roots = await this.listChildren(null);
    if (!this.accessControl) return roots;
    const visible: Node[] = [];
    for (const node of roots) {
      try {
        await this.accessControl.assertCanReadNode(actorUserId, node.id);
        visible.push(node);
      } catch (error: unknown) {
        if (!(error instanceof ForbiddenError)) throw error;
      }
    }
    return visible;
  }

  async create(node: Node): Promise<void> {
    this.database.run(`INSERT INTO nodes (id,parent_id,path,path_label,depth,node_type_id,name,description,row_version,created_at,updated_at,deleted_at,created_by,updated_by,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [node.id, node.parentId, node.path, node.pathLabel, node.depth, node.nodeTypeId, node.name, node.description, node.rowVersion, node.createdAt.toISOString(), node.updatedAt.toISOString(), node.deletedAt?.toISOString() ?? null, node.createdBy, node.updatedBy, JSON.stringify(node.payload)]);
    this.rebuildHierarchy();
  }

  async update(node: Node): Promise<void> {
    const result = this.database.run(`UPDATE nodes SET name=?, description=?, payload=?, row_version=?, updated_at=?, updated_by=? WHERE id=? AND row_version=? AND deleted_at IS NULL`, [node.name, node.description, JSON.stringify(node.payload), node.rowVersion, node.updatedAt.toISOString(), node.updatedBy, node.id, node.rowVersion - 1]);
    if (result.changes > 0) return;
    const current = this.database.get<{ row_version: number; deleted_at: string | null }>('SELECT row_version, deleted_at FROM nodes WHERE id=?', [node.id]);
    if (!current || current.deleted_at !== null) throw new NodeNotFoundError(node.id);
    throw new RowVersionMismatchError(node.rowVersion - 1, current.row_version);
  }

  async moveSubtree(nodeId: string, newParentId: string | null, actorUserId: string): Promise<void> {
    const node = this.database.get<NodeRow>('SELECT * FROM nodes WHERE id=? AND deleted_at IS NULL', [nodeId]);
    if (!node) throw new NodeNotFoundError(nodeId);
    const parent = newParentId ? this.database.get<{ path: string; depth: number }>('SELECT path, depth FROM nodes WHERE id=? AND deleted_at IS NULL', [newParentId]) : undefined;
    if (newParentId && !parent) throw new NodeNotFoundError(newParentId);
    const descendants = this.database.all<NodeRow>(`WITH RECURSIVE subtree(id) AS (SELECT id FROM nodes WHERE id=? UNION ALL SELECT n.id FROM nodes n JOIN subtree s ON n.parent_id=s.id) SELECT * FROM nodes WHERE id IN (SELECT id FROM subtree) ORDER BY depth`, [nodeId]);
    const newPath = parent ? `${parent.path}.${node.path_label}` : node.path_label;
    const oldPath = node.path;
    const depthDelta = (parent ? parent.depth + 1 : 0) - node.depth;
    for (const item of descendants) {
      const suffix = item.path === oldPath ? '' : item.path.slice(oldPath.length + 1);
      const path = suffix ? `${newPath}.${suffix}` : newPath;
      this.database.run('UPDATE nodes SET parent_id=?, path=?, depth=?, row_version=row_version+1, updated_at=?, updated_by=? WHERE id=?', [item.id === nodeId ? newParentId : item.parent_id, path, item.depth + depthDelta, new Date().toISOString(), actorUserId, item.id]);
    }
    this.rebuildHierarchy();
  }

  async listSubtree(nodeId: string): Promise<Node[]> {
    return this.database.all<NodeRow>('SELECT n.* FROM nodes n JOIN node_hierarchy h ON h.descendant_id=n.id WHERE h.ancestor_id=? AND n.deleted_at IS NULL ORDER BY h.depth ASC, n.path', [nodeId]).map((row) => this.map(row));
  }

  async existsByParentAndPathLabel(parentId: string | null, pathLabel: string): Promise<boolean> {
    const row = parentId === null ? this.database.get('SELECT 1 FROM nodes WHERE parent_id IS NULL AND path_label=? AND deleted_at IS NULL', [pathLabel]) : this.database.get('SELECT 1 FROM nodes WHERE parent_id=? AND path_label=? AND deleted_at IS NULL', [parentId, pathLabel]);
    return row !== undefined;
  }

  async listAncestorIds(nodeId: string): Promise<string[]> {
    return this.database.all<{ id: string }>('SELECT ancestor_id AS id FROM node_hierarchy WHERE descendant_id=? ORDER BY depth DESC, ancestor_id', [nodeId]).map((row) => row.id);
  }

  async isDescendantOf(nodeId: string, potentialAncestorId: string): Promise<boolean> {
    if (nodeId === potentialAncestorId) return false;
    return this.database.get('SELECT 1 FROM node_hierarchy WHERE ancestor_id=? AND descendant_id=? AND depth > 0', [potentialAncestorId, nodeId]) !== undefined;
  }

  async listDeletedByScope(_actorUserId: string, limit = 100, offset = 0): Promise<DeletedNodeSummary[]> {
    return this.database.all<DeletedNodeSummary>(`SELECT id, node_type_id AS nodeTypeId, '' AS nodeTypeName, parent_id AS parentId, '' AS parentName, name, path, row_version AS rowVersion, deleted_at AS deletedAt, deletion_batch_id AS deletionBatchId FROM nodes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
  }

  async softDeleteSubtree(nodeId: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<string[]> {
    const root = this.database.get<NodeRow>('SELECT * FROM nodes WHERE id=? AND deleted_at IS NULL AND row_version=?', [nodeId, expectedRowVersion]);
    if (!root) throw new NodeNotFoundError(nodeId);
    const ids = this.database.all<{ id: string }>(`WITH RECURSIVE subtree(id) AS (SELECT id FROM nodes WHERE id=? UNION ALL SELECT n.id FROM nodes n JOIN subtree s ON n.parent_id=s.id) SELECT id FROM subtree`, [nodeId]).map((row) => row.id);
    for (const id of ids) this.database.run('UPDATE nodes SET deleted_at=?, deletion_batch_id=?, row_version=row_version+1, updated_at=?, updated_by=? WHERE id=? AND deleted_at IS NULL', [new Date().toISOString(), deletionBatchId, new Date().toISOString(), actorUserId, id]);
    this.rebuildHierarchy();
    return ids;
  }

  async assertSubtreeUnlocked(_nodeId: string, _actorUserId: string): Promise<void> { /* lock repository is a separate SQLite vertical */ }
  async getDeletionBatchId(nodeId: string): Promise<string | null> { return this.database.get<{ deletion_batch_id: string | null }>('SELECT deletion_batch_id FROM nodes WHERE id=? AND deleted_at IS NOT NULL', [nodeId])?.deletion_batch_id ?? null; }
  async restoreSubtree(nodeId: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<string[]> {
    const root = this.database.get('SELECT id FROM nodes WHERE id=? AND deleted_at IS NOT NULL AND deletion_batch_id=? AND row_version=?', [nodeId, deletionBatchId, expectedRowVersion]);
    if (!root) throw new NodeNotFoundError(nodeId);
    const result = this.database.all<{ id: string }>('SELECT id FROM nodes WHERE deleted_at IS NOT NULL AND deletion_batch_id=?', [deletionBatchId]);
    for (const item of result) this.database.run('UPDATE nodes SET deleted_at=NULL, deletion_batch_id=NULL, row_version=row_version+1, updated_at=?, updated_by=? WHERE id=?', [new Date().toISOString(), actorUserId, item.id]);
    this.rebuildHierarchy();
    return result.map((item) => item.id);
  }

  private find(id: string, deleted: boolean): Node | null {
    const row = this.database.get<NodeRow>('SELECT * FROM nodes WHERE id=? AND deleted_at IS ' + (deleted ? 'NOT NULL' : 'NULL'), [id]);
    return row ? this.map(row) : null;
  }
  private map(row: NodeRow): Node { return new Node(row.id, row.parent_id, row.path, row.path_label, row.depth, row.node_type_id, row.name, row.description, row.row_version, new Date(row.created_at), new Date(row.updated_at), row.deleted_at ? new Date(row.deleted_at) : null, row.created_by, row.updated_by, JSON.parse(row.payload) as Record<string, unknown>); }

  private rebuildHierarchy(): void {
    this.database.exec('DELETE FROM node_hierarchy');
    this.database.exec(`INSERT INTO node_hierarchy (ancestor_id, descendant_id, depth)
      WITH RECURSIVE closure(ancestor_id, descendant_id, depth) AS (
        SELECT id, id, 0 FROM nodes WHERE deleted_at IS NULL
        UNION ALL
        SELECT closure.ancestor_id, child.id, closure.depth + 1
        FROM closure JOIN nodes child ON child.parent_id = closure.descendant_id
        WHERE child.deleted_at IS NULL
      ) SELECT ancestor_id, descendant_id, depth FROM closure`);
  }
}
