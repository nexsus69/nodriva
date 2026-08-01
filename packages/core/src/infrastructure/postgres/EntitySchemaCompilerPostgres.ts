import { z } from 'zod';
import { EntitySchemaCompiler } from '../../application/ports/EntitySchemaCompiler.js';
import { PgExecutor } from './PgExecutor.js';
import { EntityTypeNotFoundError } from '../../domain/errors/EntityErrors.js';

interface QueryRow {
  field_id: string;
  field_key: string;
  data_type: string;
  is_required: boolean;
  constraint_type: string | null;
  constraint_value_text: string | null;
}

export class EntitySchemaCompilerPostgres implements EntitySchemaCompiler {
  constructor(private readonly executor: PgExecutor) {}

  async compile(typeKey: string): Promise<z.ZodObject<any>> {
    const query = `
      SELECT 
        f.id as field_id,
        f.field_key,
        f.data_type,
        f.is_required,
        c.constraint_type,
        c.constraint_value_text
      FROM entity_types t
      JOIN entity_type_fields f ON f.entity_type_id = t.id
      LEFT JOIN entity_type_field_constraints c ON c.field_id = f.id
      WHERE t.type_key = $1
      ORDER BY f.position ASC
    `;

    const result = await this.executor.query<QueryRow>(query, [typeKey]);
    
    if (result.rows.length === 0) {
      const typeCheck = await this.executor.query('SELECT 1 FROM entity_types WHERE type_key = $1', [typeKey]);
      if (typeCheck.rows.length === 0) {
        throw new EntityTypeNotFoundError(typeKey, 'key');
      }
      return z.object({});
    }

    const fieldMap = new Map<string, { dataType: string; isRequired: boolean; constraints: { type: string; val: string }[] }>();

    for (const row of result.rows) {
      if (!fieldMap.has(row.field_key)) {
        fieldMap.set(row.field_key, {
          dataType: row.data_type,
          isRequired: row.is_required,
          constraints: [],
        });
      }
      if (row.constraint_type && row.constraint_value_text) {
        fieldMap.get(row.field_key)!.constraints.push({
          type: row.constraint_type,
          val: row.constraint_value_text,
        });
      }
    }

    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [fieldKey, fieldDef] of fieldMap.entries()) {
      let validator: z.ZodTypeAny;

      const dt = fieldDef.dataType.toLowerCase();
      if (['string', 'text', 'varchar'].includes(dt)) {
        let isEnum = false;
        let enumVal: z.ZodTypeAny = z.string();

        for (const cons of fieldDef.constraints) {
          if (cons.type === 'enum') {
            const parts = cons.val.split(',').map(p => p.trim());
            if (parts.length > 0) {
              enumVal = z.enum(parts as [string, ...string[]]);
              isEnum = true;
            }
          }
        }

        if (isEnum) {
          validator = enumVal;
        } else {
          let strVal = z.string();
          for (const cons of fieldDef.constraints) {
            if (cons.type === 'min_length') strVal = strVal.min(parseInt(cons.val, 10));
            if (cons.type === 'max_length') strVal = strVal.max(parseInt(cons.val, 10));
            if (cons.type === 'regex') strVal = strVal.regex(new RegExp(cons.val));
          }
          validator = strVal;
        }
      } else if (['number', 'integer', 'decimal', 'numeric', 'float', 'double'].includes(dt)) {
        let numVal = z.number();
        for (const cons of fieldDef.constraints) {
          if (cons.type === 'min') numVal = numVal.gte(parseFloat(cons.val));
          if (cons.type === 'max') numVal = numVal.lte(parseFloat(cons.val));
        }
        validator = numVal;
      } else if (dt === 'boolean') {
        validator = z.boolean();
      } else if (['date', 'datetime', 'timestamp'].includes(dt)) {
        validator = z.coerce.date();
      } else if (dt === 'uuid') {
        validator = z.string().uuid();
      } else {
        validator = z.any();
      }

      if (!fieldDef.isRequired) {
        validator = validator.optional().nullable();
      }

      shape[fieldKey] = validator;
    }

    return z.object(shape);
  }
}
