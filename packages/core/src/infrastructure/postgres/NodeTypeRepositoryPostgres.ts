import { NodeTypeRepository } from '../../application/ports/NodeTypeRepository.js';
import { NodeType } from '../../domain/models/NodeType.js';
import { PgExecutor } from './PgExecutor.js';

interface NodeTypeRow {
  id: string;
  type_key: string;
  name: string;
  description: string;
  current_schema_version: number;
}

export class NodeTypeRepositoryPostgres implements NodeTypeRepository {
  constructor(private readonly executor: PgExecutor) {}

  async findByKey(typeKey: string): Promise<NodeType | null> {
    const query = `
      SELECT id, type_key, name, description, current_schema_version
      FROM node_types
      WHERE type_key = $1 AND deleted_at IS NULL
    `;
    const result = await this.executor.query<NodeTypeRow>(query, [typeKey]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapToDomain(row);
  }

  async findById(id: string): Promise<NodeType | null> {
    const query = `
      SELECT id, type_key, name, description, current_schema_version
      FROM node_types
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.executor.query<NodeTypeRow>(query, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapToDomain(row);
  }

  async listAll(): Promise<NodeType[]> {
    const query = `
      SELECT id, type_key, name, description, current_schema_version
      FROM node_types
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `;
    const result = await this.executor.query<NodeTypeRow>(query);
    return result.rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: NodeTypeRow): NodeType {
    return new NodeType(
      row.id,
      row.type_key,
      row.name,
      row.description,
      Number(row.current_schema_version ?? 1)
    );
  }
}
