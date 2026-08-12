import type { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';
import { TypeDefinition, TypeFieldDefinition, TypeFieldConstraint } from '../../application/dto/TypeFieldDefinition.js';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import { SqliteDatabase } from './SqliteDatabase.js';

interface TypeRow { id: string; type_key: string; name: string; description: string; current_schema_version: number; }
interface FieldRow { id: string; field_key: string; label: string; data_type: string; is_required: number; relation_target_domain: TypeDomain | null; relation_target_type_key: string | null; encryption_mode: 'plaintext' | 'encrypted'; }

export class TypeDefinitionReaderSqlite implements TypeDefinitionReader {
  constructor(private readonly database: SqliteDatabase) {}
  async readDefinition(domain: TypeDomain, typeKey: string): Promise<TypeDefinition | null> {
    const types = domain === 'node' ? 'node_types' : 'entity_types';
    const fields = domain === 'node' ? 'node_type_fields' : 'entity_type_fields';
    const foreignKey = domain === 'node' ? 'node_type_id' : 'entity_type_id';
    const type = this.database.get<TypeRow>(`SELECT id,type_key,name,description,current_schema_version FROM ${types} WHERE type_key=? AND deleted_at IS NULL`, [typeKey]);
    if (!type) return null;
    const rows = this.database.all<FieldRow>(`SELECT id,field_key,label,data_type,is_required,relation_target_domain,relation_target_type_key,encryption_mode FROM ${fields} WHERE ${foreignKey}=? ORDER BY rowid`, [type.id]);
    return new TypeDefinition(type.id, domain, type.type_key, type.name, type.description, type.current_schema_version, rows.map((row) => new TypeFieldDefinition(row.field_key, row.data_type, row.is_required === 1, [] as TypeFieldConstraint[], row.relation_target_domain, row.relation_target_type_key, [], 'static', row.id, row.label || row.field_key, row.encryption_mode)));
  }
}
