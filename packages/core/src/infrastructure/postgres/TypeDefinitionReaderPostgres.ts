import { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';
import {
  TypeDefinition,
  TypeDomain,
  TypeFieldDefinition,
  TypeFieldConstraint,
  ConstraintType,
} from '../../application/dto/TypeFieldDefinition.js';
import { PgExecutor } from './PgExecutor.js';

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
  field_key: string;
  data_type: string;
  is_required: boolean;
  constraint_type: string | null;
  constraint_value_text: string | null;
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
}

const DOMAIN_TABLES: Record<TypeDomain, DomainTableConfig> = {
  node: {
    typesTable: 'node_types',
    fieldsTable: 'node_type_fields',
    constraintsTable: 'node_type_field_constraints',
    fieldForeignKey: 'node_type_id',
  },
  entity: {
    typesTable: 'entity_types',
    fieldsTable: 'entity_type_fields',
    constraintsTable: 'entity_type_field_constraints',
    fieldForeignKey: 'entity_type_id',
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
      WHERE type_key = $1 AND deleted_at IS NULL
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
        f.field_key,
        f.data_type,
        f.is_required,
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
      constraints: TypeFieldConstraint[];
    }>();

    for (const row of result.rows) {
      if (!fieldMap.has(row.field_key)) {
        fieldMap.set(row.field_key, {
          dataType: row.data_type,
          isRequired: row.is_required,
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
          entry.constraints
        )
      );
    }

    return fields;
  }
}
