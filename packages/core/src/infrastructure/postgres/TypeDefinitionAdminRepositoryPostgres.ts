import type { TypeDefinitionAdminRepository } from '../../application/ports/TypeDefinitionAdminRepository.js';
import type { TypeDomain, ConstraintType } from '../../application/dto/TypeFieldDefinition.js';
import type { TypeListItemDto, TypeDetailDto, FieldDto, FieldConstraintDto, FieldDataType } from '../../application/dto/AdminContractDtos.js';
import { ManagedTypeDefinition } from '../../domain/models/ManagedTypeDefinition.js';
import { ManagedTypeField } from '../../domain/models/ManagedTypeField.js';
import { ManagedTypeFieldConstraint } from '../../domain/models/ManagedTypeFieldConstraint.js';
import type { ManagedEnumOption } from '../../domain/models/ManagedEnumOption.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { TypeDefinitionNotFoundError } from '../../domain/errors/TypeAdminErrors.js';
import type { PgExecutor } from './PgExecutor.js';

// ─── Table Config ────────────────────────────────────────────────

interface AdminDomainTableConfig {
  typesTable: string;
  fieldsTable: string;
  constraintsTable: string;
  fieldForeignKey: string;
  instancesTable: string;
  instanceTypeForeignKey: string;
}

const DOMAIN_TABLES: Record<TypeDomain, AdminDomainTableConfig> = {
  node: {
    typesTable: 'node_types',
    fieldsTable: 'node_type_fields',
    constraintsTable: 'node_type_field_constraints',
    fieldForeignKey: 'node_type_id',
    instancesTable: 'nodes',
    instanceTypeForeignKey: 'node_type_id',
  },
  entity: {
    typesTable: 'entity_types',
    fieldsTable: 'entity_type_fields',
    constraintsTable: 'entity_type_field_constraints',
    fieldForeignKey: 'entity_type_id',
    instancesTable: 'entities',
    instanceTypeForeignKey: 'entity_type_id',
  },
};

// ─── Row Interfaces ──────────────────────────────────────────────

interface TypeRowBase {
  id: string;
  type_key: string;
  name: string;
  description: string;
  current_schema_version: number;
  is_active: boolean;
  is_system: boolean;
  row_version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface EntityTypeRowExtra extends TypeRowBase {
  storage_table: string;
  placement_policy_id: string | null;
}

interface FieldRow {
  id: string;
  type_fk_id: string;
  field_key: string;
  label: string;
  column_name: string;
  data_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_indexed: boolean;
  default_value_text: string | null;
  position: number;
  is_system: boolean;
  relation_target_domain: TypeDomain | null;
  relation_target_type_key: string | null;
  relation_source_cardinality: 'one' | 'many';
  relation_target_is_unique: boolean;
  relation_inverse_label: string | null;
  enum_mode: 'static' | 'managed';
  encryption_mode: 'plaintext' | 'encrypted';
  created_at: Date;
  updated_at: Date;
}

interface ConstraintRow {
  id: string;
  field_id: string;
  constraint_type: string;
  constraint_value_text: string;
  created_at: Date;
}

interface TypeListRow {
  id: string;
  typeKey: string;
  name: string;
  description: string | null;
  storageTable: string | null;
  currentSchemaVersion: number;
  isActive: boolean;
  isSystem: boolean;
  rowVersion: number;
  updatedAt: Date;
  fieldCount: number;
}

interface TypeDetailRow {
  id: string;
  typeKey: string;
  name: string;
  description: string | null;
  storageTable: string | null;
  placementPolicyId: string | null;
  currentSchemaVersion: number;
  isActive: boolean;
  isSystem: boolean;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FieldDetailRow {
  id: string;
  fieldKey: string;
  label: string;
  columnName: string;
  dataType: string;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  defaultValueText: string | null;
  position: number;
  isSystem: boolean;
  relationTargetDomain: TypeDomain | null;
  relationTargetTypeKey: string | null;
  relationSourceCardinality: 'one' | 'many';
  relationTargetIsUnique: boolean;
  relationInverseLabel: string | null;
  enumMode: 'static' | 'managed';
  encryptionMode: 'plaintext' | 'encrypted';
  updatedAt: Date;
}

interface ConstraintDetailRow {
  id: string;
  fieldId: string;
  constraintType: string;
  constraintValueText: string;
}

interface EnumOptionDetailRow {
  id: string;
  fieldId: string;
  value: string;
  label: string;
  position: number;
  isActive: boolean;
}

interface CountRow {
  count: number;
}

// ─── Adapter ─────────────────────────────────────────────────────

export class TypeDefinitionAdminRepositoryPostgres implements TypeDefinitionAdminRepository {
  constructor(private readonly executor: PgExecutor) {}

  // ─── Type ────────────────────────────────────────────────────

  async findTypeById(domain: TypeDomain, id: string): Promise<ManagedTypeDefinition | null> {
    const cfg = DOMAIN_TABLES[domain];
    const cols = this.typeSelectColumns(domain);
    const query = `SELECT ${cols} FROM ${cfg.typesTable} WHERE id = $1`;
    const result = await this.executor.query<TypeRowBase & Partial<EntityTypeRowExtra>>(query, [id]);
    const row = result.rows[0];
    return row ? this.mapTypeToDomain(domain, row) : null;
  }

  async findTypeByKey(domain: TypeDomain, typeKey: string): Promise<ManagedTypeDefinition | null> {
    const cfg = DOMAIN_TABLES[domain];
    const cols = this.typeSelectColumns(domain);
    const query = `SELECT ${cols} FROM ${cfg.typesTable} WHERE type_key = $1 AND deleted_at IS NULL`;
    const result = await this.executor.query<TypeRowBase & Partial<EntityTypeRowExtra>>(query, [typeKey]);
    const row = result.rows[0];
    return row ? this.mapTypeToDomain(domain, row) : null;
  }

  async listTypes(domain: TypeDomain): Promise<TypeListItemDto[]> {
    const cfg = DOMAIN_TABLES[domain];
    const query = `
      SELECT 
        t.id,
        t.type_key AS "typeKey",
        t.name,
        t.description,
        ${domain === 'entity' ? 't.storage_table AS "storageTable",' : 'NULL AS "storageTable",'}
        t.current_schema_version AS "currentSchemaVersion",
        t.is_active AS "isActive",
        t.is_system AS "isSystem",
        t.row_version AS "rowVersion",
        t.updated_at AS "updatedAt",
        COALESCE(f.field_count, 0)::int AS "fieldCount"
      FROM ${cfg.typesTable} t
      LEFT JOIN (
        SELECT ${cfg.fieldForeignKey}, COUNT(*)::int AS field_count
        FROM ${cfg.fieldsTable}
        GROUP BY ${cfg.fieldForeignKey}
      ) f ON f.${cfg.fieldForeignKey} = t.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.name ASC
    `;
    const res = await this.executor.query<TypeListRow>(query);
    return res.rows.map((r) => ({
      id: r.id,
      kind: domain,
      typeKey: r.typeKey,
      name: r.name,
      description: r.description ?? '',
      storageTable: r.storageTable ?? null,
      currentSchemaVersion: Number(r.currentSchemaVersion),
      isActive: Boolean(r.isActive),
      isSystem: Boolean(r.isSystem),
      rowVersion: Number(r.rowVersion),
      fieldCount: Number(r.fieldCount),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  async getTypeDetail(domain: TypeDomain, typeKey: string): Promise<TypeDetailDto | null> {
    const cfg = DOMAIN_TABLES[domain];

    // 1. Tipo base
    const typeQuery = `
      SELECT 
        id, type_key AS "typeKey", name, description,
        ${domain === 'entity' ? 'storage_table AS "storageTable", placement_policy_id AS "placementPolicyId",' : 'NULL AS "storageTable", NULL AS "placementPolicyId",'}
        current_schema_version AS "currentSchemaVersion",
        is_active AS "isActive", is_system AS "isSystem",
        row_version AS "rowVersion", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM ${cfg.typesTable}
      WHERE type_key = $1 AND deleted_at IS NULL
    `;
    const typeRes = await this.executor.query<TypeDetailRow>(typeQuery, [typeKey]);
    if (typeRes.rows.length === 0) {
      return null;
    }
    const t = typeRes.rows[0];
    if (!t) return null;

    // 2. Campi del tipo
    const fieldsQuery = `
       SELECT
        id, field_key AS "fieldKey", label, column_name AS "columnName",
        data_type AS "dataType", is_required AS "isRequired",
        is_unique AS "isUnique", is_indexed AS "isIndexed",
        default_value_text AS "defaultValueText", position,
        is_system AS "isSystem",
        relation_target_domain AS "relationTargetDomain",
        relation_target_type_key AS "relationTargetTypeKey",
        relation_source_cardinality AS "relationSourceCardinality",
        relation_target_is_unique AS "relationTargetIsUnique",
        relation_inverse_label AS "relationInverseLabel",
        enum_mode AS "enumMode", encryption_mode AS "encryptionMode",
        updated_at AS "updatedAt"
      FROM ${cfg.fieldsTable}
      WHERE ${cfg.fieldForeignKey} = $1
      ORDER BY position ASC
    `;
    const fieldsRes = await this.executor.query<FieldDetailRow>(fieldsQuery, [t.id]);

    // 3. Vincoli
    const fieldIds = fieldsRes.rows.map((f) => f.id);
    const constraintsByField: Record<string, FieldConstraintDto[]> = {};
    if (fieldIds.length > 0) {
      const constrQuery = `
        SELECT id, field_id AS "fieldId", constraint_type AS "constraintType", constraint_value_text AS "constraintValueText"
        FROM ${cfg.constraintsTable}
        WHERE field_id = ANY($1::uuid[])
      `;
      const constrRes = await this.executor.query<ConstraintDetailRow>(constrQuery, [fieldIds]);
      for (const c of constrRes.rows) {
        if (!constraintsByField[c.fieldId]) {
          constraintsByField[c.fieldId] = [];
        }
        constraintsByField[c.fieldId]!.push({
          id: c.id,
          constraintType: c.constraintType as ConstraintType,
          constraintValueText: c.constraintValueText,
        });
      }
    }

    const enumOptionsByField: Record<string, EnumOptionDetailRow[]> = {};
    if (fieldIds.length > 0) {
      const enumTable = domain === 'entity' ? 'entity_type_field_enum_options' : 'node_type_field_enum_options';
      const enumRes = await this.executor.query<EnumOptionDetailRow>(
        `SELECT id, field_id AS "fieldId", value, label, position, is_active AS "isActive"
         FROM ${enumTable} WHERE field_id = ANY($1::uuid[]) ORDER BY position ASC`,
        [fieldIds]
      );
      for (const option of enumRes.rows) (enumOptionsByField[option.fieldId] ??= []).push(option);
    }

    // 4. Conteggio istanze
    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM ${cfg.instancesTable}
      WHERE ${cfg.instanceTypeForeignKey} = $1 AND deleted_at IS NULL
    `;
    const countRes = await this.executor.query<CountRow>(countQuery, [t.id]);
    const instanceCount = Number(countRes.rows[0]?.count ?? 0);

    const fields: FieldDto[] = fieldsRes.rows.map((f) => ({
      id: f.id,
      fieldKey: f.fieldKey,
      label: f.label,
      columnName: f.columnName,
      dataType: f.dataType as FieldDataType,
      isRequired: Boolean(f.isRequired),
      isUnique: Boolean(f.isUnique),
      isIndexed: Boolean(f.isIndexed),
      defaultValueText: f.defaultValueText ?? null,
      position: Number(f.position),
      isSystem: Boolean(f.isSystem),
      relationTargetDomain: f.relationTargetDomain ?? null,
      relationTargetTypeKey: f.relationTargetTypeKey ?? null,
      relationSourceCardinality: f.relationSourceCardinality ?? 'one',
      relationTargetIsUnique: Boolean(f.relationTargetIsUnique),
      relationInverseLabel: f.relationInverseLabel ?? null,
      enumMode: f.enumMode ?? 'static',
      encryptionMode: f.encryptionMode ?? 'plaintext',
      enumOptions: enumOptionsByField[f.id] ?? [],
      constraints: constraintsByField[f.id] ?? [],
      updatedAt: new Date(f.updatedAt).toISOString(),
    }));

    const isSystem = Boolean(t.isSystem);
    return {
      id: t.id,
      kind: domain,
      typeKey: t.typeKey,
      name: t.name,
      description: t.description ?? '',
      storageTable: t.storageTable ?? null,
      placementPolicyId: t.placementPolicyId ?? null,
      currentSchemaVersion: Number(t.currentSchemaVersion),
      isActive: Boolean(t.isActive),
      isSystem,
      rowVersion: Number(t.rowVersion),
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString(),
      fields,
      isEditable: !isSystem,
      isDeletable: !isSystem && instanceCount === 0,
      instanceCount,
    };
  }

  async createType(domain: TypeDomain, typeDef: ManagedTypeDefinition): Promise<void> {
    if (domain === 'entity') {
      await this.executor.query(
        `INSERT INTO entity_types (id, type_key, name, description, storage_table, placement_policy_id,
           current_schema_version, is_active, is_system, row_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [typeDef.id, typeDef.typeKey, typeDef.name, typeDef.description,
         typeDef.storageTable, typeDef.placementPolicyId,
         typeDef.currentSchemaVersion, typeDef.isActive, typeDef.isSystem,
         typeDef.rowVersion, typeDef.createdAt, typeDef.updatedAt]
      );
    } else {
      await this.executor.query(
        `INSERT INTO node_types (id, type_key, name, description,
           current_schema_version, is_active, is_system, row_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [typeDef.id, typeDef.typeKey, typeDef.name, typeDef.description,
         typeDef.currentSchemaVersion, typeDef.isActive, typeDef.isSystem,
         typeDef.rowVersion, typeDef.createdAt, typeDef.updatedAt]
      );
    }
  }

  async updateType(domain: TypeDomain, typeDef: ManagedTypeDefinition): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    const previousRowVersion = typeDef.rowVersion - 1;
    const query = `
      UPDATE ${cfg.typesTable}
      SET name = $1, description = $2, current_schema_version = $3, is_active = $4,
          row_version = $5, updated_at = $6
      WHERE id = $7 AND row_version = $8 AND deleted_at IS NULL
    `;
    const result = await this.executor.query(query, [
      typeDef.name, typeDef.description, typeDef.currentSchemaVersion, typeDef.isActive,
      typeDef.rowVersion, typeDef.updatedAt, typeDef.id, previousRowVersion,
    ]);

    if (result.rowCount === 0) {
      const check = await this.executor.query<{ row_version: number; deleted_at: Date | null }>(
        `SELECT row_version, deleted_at FROM ${cfg.typesTable} WHERE id = $1`, [typeDef.id]
      );
      const checkRow = check.rows[0];
      if (!checkRow || checkRow.deleted_at !== null) {
        throw new TypeDefinitionNotFoundError(typeDef.id, domain);
      }
      throw new RowVersionMismatchError(previousRowVersion, checkRow.row_version);
    }
  }

  // ─── Field ───────────────────────────────────────────────────

  async findFieldById(domain: TypeDomain, fieldId: string): Promise<ManagedTypeField | null> {
    const cfg = DOMAIN_TABLES[domain];
    const query = `
      SELECT id, ${cfg.fieldForeignKey} AS type_fk_id, field_key, label, column_name, data_type,
             is_required, is_unique, is_indexed, default_value_text, position, is_system,
             relation_target_domain, relation_target_type_key,
             relation_source_cardinality, relation_target_is_unique, relation_inverse_label,
             enum_mode, encryption_mode,
             created_at, updated_at
      FROM ${cfg.fieldsTable}
      WHERE id = $1
    `;
    const result = await this.executor.query<FieldRow>(query, [fieldId]);
    const row = result.rows[0];
    return row ? this.mapFieldToDomain(row) : null;
  }

  async createField(domain: TypeDomain, field: ManagedTypeField): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    await this.executor.query(
      `INSERT INTO ${cfg.fieldsTable}
         (id, ${cfg.fieldForeignKey}, field_key, label, column_name, data_type,
          is_required, is_unique, is_indexed, default_value_text, position, is_system,
          relation_target_domain, relation_target_type_key,
          relation_source_cardinality, relation_target_is_unique, relation_inverse_label,
          enum_mode, encryption_mode, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [field.id, field.typeDefinitionId, field.fieldKey, field.label, field.columnName,
       field.dataType, field.isRequired, field.isUnique, field.isIndexed,
       field.defaultValueText, field.position, field.isSystem,
       field.relationTargetDomain, field.relationTargetTypeKey,
       field.relationSourceCardinality, field.relationTargetIsUnique, field.relationInverseLabel,
       field.enumMode, field.encryptionMode,
       field.createdAt, field.updatedAt]
    );
  }

  async updateField(domain: TypeDomain, field: ManagedTypeField): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    await this.executor.query(
      `UPDATE ${cfg.fieldsTable}
       SET label = $1, is_required = $2, is_unique = $3, is_indexed = $4,
           default_value_text = $5, position = $6, encryption_mode = $7, updated_at = $8
       WHERE id = $9`,
      [field.label, field.isRequired, field.isUnique, field.isIndexed,
       field.defaultValueText, field.position, field.encryptionMode, field.updatedAt, field.id]
    );
  }

  async deleteField(domain: TypeDomain, fieldId: string): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    await this.executor.query(`DELETE FROM ${cfg.fieldsTable} WHERE id = $1`, [fieldId]);
  }

  async existsFieldByKey(domain: TypeDomain, typeId: string, fieldKey: string): Promise<boolean> {
    const cfg = DOMAIN_TABLES[domain];
    const result = await this.executor.query(
      `SELECT 1 FROM ${cfg.fieldsTable} WHERE ${cfg.fieldForeignKey} = $1 AND field_key = $2 LIMIT 1`,
      [typeId, fieldKey]
    );
    return result.rows.length > 0;
  }

  async existsFieldByColumnName(domain: TypeDomain, typeId: string, columnName: string): Promise<boolean> {
    const cfg = DOMAIN_TABLES[domain];
    const result = await this.executor.query(
      `SELECT 1 FROM ${cfg.fieldsTable} WHERE ${cfg.fieldForeignKey} = $1 AND column_name = $2 LIMIT 1`,
      [typeId, columnName]
    );
    return result.rows.length > 0;
  }

  // ─── Constraint ──────────────────────────────────────────────

  async findConstraintById(domain: TypeDomain, constraintId: string): Promise<ManagedTypeFieldConstraint | null> {
    const cfg = DOMAIN_TABLES[domain];
    const result = await this.executor.query<ConstraintRow>(
      `SELECT id, field_id, constraint_type, constraint_value_text, created_at
       FROM ${cfg.constraintsTable} WHERE id = $1`,
      [constraintId]
    );
    const row = result.rows[0];
    return row ? this.mapConstraintToDomain(row) : null;
  }

  async createConstraint(domain: TypeDomain, constraint: ManagedTypeFieldConstraint): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    await this.executor.query(
      `INSERT INTO ${cfg.constraintsTable} (id, field_id, constraint_type, constraint_value_text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [constraint.id, constraint.fieldId, constraint.constraintType,
       constraint.constraintValueText, constraint.createdAt]
    );
  }

  async updateConstraint(domain: TypeDomain, constraint: ManagedTypeFieldConstraint): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    await this.executor.query(
      `UPDATE ${cfg.constraintsTable} SET constraint_value_text = $1 WHERE id = $2`,
      [constraint.constraintValueText, constraint.id]
    );
  }

  async deleteConstraint(domain: TypeDomain, constraintId: string): Promise<void> {
    const cfg = DOMAIN_TABLES[domain];
    await this.executor.query(`DELETE FROM ${cfg.constraintsTable} WHERE id = $1`, [constraintId]);
  }

  async existsEnumOption(domain: TypeDomain, fieldId: string, value: string): Promise<boolean> {
    const table = domain === 'entity' ? 'entity_type_field_enum_options' : 'node_type_field_enum_options';
    const result = await this.executor.query(`SELECT 1 FROM ${table} WHERE field_id = $1 AND value = $2 LIMIT 1`, [fieldId, value]);
    return result.rows.length > 0;
  }

  async createEnumOption(domain: TypeDomain, option: ManagedEnumOption): Promise<void> {
    const table = domain === 'entity' ? 'entity_type_field_enum_options' : 'node_type_field_enum_options';
    await this.executor.query(
      `INSERT INTO ${table} (id, field_id, value, label, position, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [option.id, option.fieldId, option.value, option.label, option.position, option.isActive, option.createdAt, option.updatedAt]
    );
  }

  // ─── Integrity ───────────────────────────────────────────────

  async hasInstancesOfType(domain: TypeDomain, typeId: string): Promise<boolean> {
    const cfg = DOMAIN_TABLES[domain];
    const result = await this.executor.query(
      `SELECT 1 FROM ${cfg.instancesTable} WHERE ${cfg.instanceTypeForeignKey} = $1 AND deleted_at IS NULL LIMIT 1`,
      [typeId]
    );
    return result.rows.length > 0;
  }

  async hasValuesInField(domain: TypeDomain, typeId: string, fieldKey: string, columnName: string): Promise<boolean> {
    if (domain === 'node') {
      const attachmentResult = await this.executor.query<{ data_type: string }>(
        'SELECT data_type FROM node_type_fields WHERE node_type_id = $1 AND field_key = $2', [typeId, fieldKey]
      );
      if (['file', 'image'].includes(attachmentResult.rows[0]?.data_type?.toLowerCase() ?? '')) {
        const result = await this.executor.query(
          `SELECT 1 FROM resource_attachments ra JOIN nodes n ON n.id = ra.resource_id
           WHERE ra.resource_type = 'node' AND ra.field_key = $2 AND n.node_type_id = $1 LIMIT 1`, [typeId, fieldKey]
        );
        return result.rows.length > 0;
      }
      const result = await this.executor.query(
        `SELECT 1 FROM nodes
         WHERE node_type_id = $1 AND deleted_at IS NULL
           AND payload ? $2 AND payload -> $2 IS NOT NULL
         LIMIT 1`,
        [typeId, fieldKey]
      );
      return result.rows.length > 0;
    }

    const typeResult = await this.executor.query<{ storage_table: string }>(
      'SELECT storage_table FROM entity_types WHERE id = $1 AND deleted_at IS NULL',
      [typeId]
    );
    const storageTable = typeResult.rows[0]?.storage_table;
    if (!storageTable) return false;

    const attachmentResult = await this.executor.query<{ data_type: string }>(
      'SELECT data_type FROM entity_type_fields WHERE entity_type_id = $1 AND field_key = $2', [typeId, fieldKey]
    );
    if (['file', 'image'].includes(attachmentResult.rows[0]?.data_type?.toLowerCase() ?? '')) {
      const result = await this.executor.query(
        `SELECT 1 FROM resource_attachments ra JOIN entities e ON e.id = ra.resource_id
         WHERE ra.resource_type = 'entity' AND ra.field_key = $2 AND e.entity_type_id = $1 LIMIT 1`, [typeId, fieldKey]
      );
      return result.rows.length > 0;
    }

    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);
    const result = await this.executor.query(
      `SELECT 1
       FROM ${escapedTable} s
       JOIN entities e ON e.id = s.entity_id
       WHERE e.entity_type_id = $1
         AND e.deleted_at IS NULL
         AND s.${escapedColumn} IS NOT NULL
       LIMIT 1`,
      [typeId]
    );
    return result.rows.length > 0;
  }

  async countIncomingRelations(domain: TypeDomain, typeKey: string): Promise<number> {
    const result = await this.executor.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (
         SELECT id FROM node_type_fields
         WHERE data_type = 'relation' AND relation_target_domain = $1 AND relation_target_type_key = $2
         UNION ALL
         SELECT id FROM entity_type_fields
         WHERE data_type = 'relation' AND relation_target_domain = $1 AND relation_target_type_key = $2
       ) incoming_relations`,
      [domain, typeKey],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  // ─── Mapping ─────────────────────────────────────────────────

  private typeSelectColumns(domain: TypeDomain): string {
    const base = 'id, type_key, name, description, current_schema_version, is_active, is_system, row_version, created_at, updated_at, deleted_at';
    return domain === 'entity' ? `${base}, storage_table, placement_policy_id` : base;
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private mapTypeToDomain(domain: TypeDomain, row: TypeRowBase & Partial<EntityTypeRowExtra>): ManagedTypeDefinition {
    return new ManagedTypeDefinition(
      row.id, row.type_key, row.name, row.description,
      domain === 'entity' ? (row.storage_table ?? null) : null,
      domain === 'entity' ? (row.placement_policy_id ?? null) : null,
      row.current_schema_version, row.is_active, row.is_system,
      row.row_version, row.created_at, row.updated_at, row.deleted_at
    );
  }

  private mapFieldToDomain(row: FieldRow): ManagedTypeField {
    return new ManagedTypeField(
      row.id, row.type_fk_id, row.field_key, row.label, row.column_name,
      row.data_type, row.is_required, row.is_unique, row.is_indexed,
      row.default_value_text, row.position, row.is_system,
      row.created_at, row.updated_at,
      row.relation_target_domain, row.relation_target_type_key, row.enum_mode, row.encryption_mode,
      row.relation_source_cardinality, row.relation_target_is_unique, row.relation_inverse_label
    );
  }

  private mapConstraintToDomain(row: ConstraintRow): ManagedTypeFieldConstraint {
    return new ManagedTypeFieldConstraint(
      row.id, row.field_id, row.constraint_type as ConstraintType,
      row.constraint_value_text, row.created_at
    );
  }
}
