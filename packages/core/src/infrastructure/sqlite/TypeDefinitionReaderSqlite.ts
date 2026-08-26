/** Reads runtime type definitions from SQLite without exposing storage-specific rows. */

import type { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';
import {
  TypeDefinition,
  TypeFieldConstraint,
  TypeFieldDefinition,
  type ConstraintType,
  type EnumOptionDefinition,
  type TypeDomain,
} from '../../application/dto/TypeFieldDefinition.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface TypeRow {
  id: string;
  type_key: string;
  name: string;
  description: string;
  current_schema_version: number;
  is_active: number;
}

interface FieldRow {
  id: string;
  field_key: string;
  label: string;
  data_type: string;
  is_required: number;
  relation_target_domain: TypeDomain | null;
  relation_target_type_key: string | null;
  relation_source_cardinality: 'one' | 'many';
  relation_target_is_unique: number;
  relation_inverse_label: string | null;
  encryption_mode: 'plaintext' | 'encrypted';
  enum_mode: 'static' | 'managed';
}

interface ConstraintRow {
  field_id: string;
  constraint_type: ConstraintType;
  constraint_value_text: string;
}

interface EnumOptionRow {
  field_id: string;
  value: string;
  label: string;
  position: number;
  is_active: number;
}

export class TypeDefinitionReaderSqlite implements TypeDefinitionReader {
  constructor(private readonly database: SqliteDatabase) {}
  async readDefinition(domain: TypeDomain, typeKey: string): Promise<TypeDefinition | null> {
    const types = domain === 'node' ? 'node_types' : 'entity_types';
    const fields = domain === 'node' ? 'node_type_fields' : 'entity_type_fields';
    const foreignKey = domain === 'node' ? 'node_type_id' : 'entity_type_id';
    const constraintsTable = domain === 'node' ? 'node_type_field_constraints' : 'entity_type_field_constraints';
    const enumOptionsTable = domain === 'node' ? 'node_type_field_enum_options' : 'entity_type_field_enum_options';
    const type = this.database.get<TypeRow>(
      `SELECT id,type_key,name,description,current_schema_version,is_active FROM ${types} WHERE type_key=? AND deleted_at IS NULL`,
      [typeKey],
    );
    if (!type || type.is_active !== 1) return null;

    const rows = this.database.all<FieldRow>(
      `SELECT id,field_key,label,data_type,is_required,relation_target_domain,relation_target_type_key,
              relation_source_cardinality,relation_target_is_unique,relation_inverse_label,encryption_mode,enum_mode
       FROM ${fields} WHERE ${foreignKey}=? ORDER BY position, id`,
      [type.id],
    );
    const fieldIds = rows.map((row) => row.id);
    if (fieldIds.length === 0) {
      return new TypeDefinition(type.id, domain, type.type_key, type.name, type.description, type.current_schema_version, []);
    }
    const placeholders = fieldIds.map(() => '?').join(',');
    const constraintsByField = new Map<string, TypeFieldConstraint[]>();
    for (const row of this.database.all<ConstraintRow>(
      `SELECT field_id,constraint_type,constraint_value_text FROM ${constraintsTable} WHERE field_id IN (${placeholders}) ORDER BY created_at, id`,
      fieldIds,
    )) {
      const constraints = constraintsByField.get(row.field_id) ?? [];
      constraints.push(new TypeFieldConstraint(row.constraint_type, row.constraint_value_text));
      constraintsByField.set(row.field_id, constraints);
    }
    const enumOptionsByField = new Map<string, EnumOptionDefinition[]>();
    for (const row of this.database.all<EnumOptionRow>(
      `SELECT field_id,value,label,position,is_active FROM ${enumOptionsTable} WHERE field_id IN (${placeholders}) ORDER BY position, id`,
      fieldIds,
    )) {
      const options = enumOptionsByField.get(row.field_id) ?? [];
      options.push({ value: row.value, label: row.label, position: Number(row.position), isActive: row.is_active === 1 });
      enumOptionsByField.set(row.field_id, options);
    }
    return new TypeDefinition(
      type.id,
      domain,
      type.type_key,
      type.name,
      type.description,
      type.current_schema_version,
      rows.map((row) => new TypeFieldDefinition(
        row.field_key,
        row.data_type,
        row.is_required === 1,
        constraintsByField.get(row.id) ?? [],
        row.relation_target_domain,
        row.relation_target_type_key,
        enumOptionsByField.get(row.id) ?? [],
        row.enum_mode,
        row.id,
        row.label || row.field_key,
        row.encryption_mode,
        row.relation_source_cardinality ?? 'one',
        row.relation_target_is_unique === 1,
        row.relation_inverse_label,
      )),
    );
  }
}
