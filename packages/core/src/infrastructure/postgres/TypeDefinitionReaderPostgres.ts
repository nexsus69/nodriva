import type { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';
import type {
  TypeDomain,
  ConstraintType,
  EnumOptionDefinition} from '../../application/dto/TypeFieldDefinition.js';
import {
  TypeDefinition,
  TypeFieldDefinition,
  TypeFieldConstraint
} from '../../application/dto/TypeFieldDefinition.js';
import type { PgExecutor } from './PgExecutor.js';

/**
 * Riga restituita dalla query di metadati del tipo.
 */
interface TypeMetaRow {
  id: string;
  type_key: string;
  name: string;
  description: string;
  current_schema_version: number;
}

/**
 * Riga restituita dalla query di campi + vincoli.
 */
interface FieldWithConstraintRow {
  id: string;
  field_key: string;
  label: string;
  data_type: string;
  is_required: boolean;
  relation_target_domain: TypeDomain | null;
  relation_target_type_key: string | null;
  encryption_mode: 'plaintext' | 'encrypted';
  enum_mode: 'static' | 'managed';
  constraint_type: string | null;
  constraint_value_text: string | null;
  enum_options: EnumOptionDefinition[] | null;
}

/**
 * Mapping statico delle tabelle per dominio.
 * Nessun input utente viene usato come nome di tabella — solo valori whitelistati.
 */
interface DomainTableConfig {
  typesTable: string;
  fieldsTable: string;
  constraintsTable: string;
  fieldForeignKey: string;
  enumOptionsTable: string;
}

const DOMAIN_TABLES: Record<TypeDomain, DomainTableConfig> = {
  node: {
    typesTable: 'node_types',
    fieldsTable: 'node_type_fields',
    constraintsTable: 'node_type_field_constraints',
    fieldForeignKey: 'node_type_id',
    enumOptionsTable: 'node_type_field_enum_options',
  },
  entity: {
    typesTable: 'entity_types',
    fieldsTable: 'entity_type_fields',
    constraintsTable: 'entity_type_field_constraints',
    fieldForeignKey: 'entity_type_id',
    enumOptionsTable: 'entity_type_field_enum_options',
  },
};

/**
 * Implementazione PostgreSQL del TypeDefinitionReader.
 * Legge metadati del tipo + campi + vincoli dalle tabelle appropriate
 * in base al dominio ('node' | 'entity').
 *
 * I nomi delle tabelle sono whitelistati staticamente, non interpolati da input utente.
 */
export class TypeDefinitionReaderPostgres implements TypeDefinitionReader {
  constructor(private readonly executor: PgExecutor) {}

  async readDefinition(domain: TypeDomain, typeKey: string): Promise<TypeDefinition | null> {
    const config = DOMAIN_TABLES[domain];

    // 1. Leggi i metadati del tipo
    const typeMeta = await this.readTypeMeta(config, typeKey);
    if (!typeMeta) {
      return null;
    }

    // 2. Leggi campi + vincoli in una sola query (JOIN)
    const fields = await this.readFieldsWithConstraints(config, typeMeta.id);

    return new TypeDefinition(
      typeMeta.id,
      domain,
      typeMeta.type_key,
      typeMeta.name,
      typeMeta.description,
      typeMeta.current_schema_version,
      fields
    );
  }

  private async readTypeMeta(config: DomainTableConfig, typeKey: string): Promise<TypeMetaRow | null> {
    // Le tabelle sono costanti whitelistate, non interpolate da input.
    const query = `
      SELECT id, type_key, name, description, current_schema_version
      FROM ${config.typesTable}
      -- Runtime schema resolution must only expose operational types. The
      -- administrative repository deliberately has a different contract: it
      -- also exposes inactive types so they can be inspected and re-enabled.
      WHERE type_key = $1 AND deleted_at IS NULL AND is_active = TRUE
    `;
    const result = await this.executor.query<TypeMetaRow>(query, [typeKey]);
    return result.rows[0] ?? null;
  }

  private async readFieldsWithConstraints(
    config: DomainTableConfig,
    typeId: string
  ): Promise<TypeFieldDefinition[]> {
    const query = `
      SELECT
        f.id,
        f.field_key,
        f.label,
        f.data_type,
        f.is_required,
        f.relation_target_domain,
        f.relation_target_type_key,
        f.encryption_mode,
        f.enum_mode,
        COALESCE((SELECT json_agg(json_build_object(
          'value', eo.value, 'label', eo.label, 'isActive', eo.is_active, 'position', eo.position
        ) ORDER BY eo.position) FROM ${config.enumOptionsTable} eo WHERE eo.field_id = f.id AND eo.is_active = TRUE), '[]'::json) AS enum_options,
        c.constraint_type,
        c.constraint_value_text
      FROM ${config.fieldsTable} f
      LEFT JOIN ${config.constraintsTable} c ON c.field_id = f.id
      WHERE f.${config.fieldForeignKey} = $1
      ORDER BY f.position ASC
    `;
    const result = await this.executor.query<FieldWithConstraintRow>(query, [typeId]);

    // Raggruppa le righe per field_key (una riga per ogni vincolo, stesse colonne campo)
    const fieldMap = new Map<string, {
      dataType: string;
      isRequired: boolean;
      relationTargetDomain: TypeDomain | null;
      relationTargetTypeKey: string | null;
      enumMode: 'static' | 'managed';
      enumOptions: EnumOptionDefinition[];
      encryptionMode: 'plaintext' | 'encrypted';
      id: string;
      label: string;
      constraints: TypeFieldConstraint[];
    }>();

    for (const row of result.rows) {
      if (!fieldMap.has(row.field_key)) {
        fieldMap.set(row.field_key, {
          dataType: row.data_type,
          isRequired: row.is_required,
          relationTargetDomain: row.relation_target_domain,
          relationTargetTypeKey: row.relation_target_type_key,
          enumMode: row.enum_mode ?? 'static',
          enumOptions: row.enum_options ?? [],
          encryptionMode: row.encryption_mode ?? 'plaintext',
          id: row.id,
          label: row.label,
          constraints: [],
        });
      }
      if (row.constraint_type && row.constraint_value_text) {
        const entry = fieldMap.get(row.field_key);
        if (entry) {
          entry.constraints.push(
            new TypeFieldConstraint(
              row.constraint_type as ConstraintType,
              row.constraint_value_text
            )
          );
        }
      }
    }

    const fields: TypeFieldDefinition[] = [];
    for (const [fieldKey, entry] of fieldMap.entries()) {
      fields.push(
        new TypeFieldDefinition(
          fieldKey,
          entry.dataType,
          entry.isRequired,
          entry.constraints,
          entry.relationTargetDomain,
          entry.relationTargetTypeKey
          , entry.enumOptions
          , entry.enumMode
          , entry.id
          , entry.label
          , entry.encryptionMode
        )
      );
    }

    return fields;
  }
}
