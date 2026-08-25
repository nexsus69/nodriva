import { z } from 'zod';
import type { TypeFieldDefinition } from '../../application/dto/TypeFieldDefinition.js';
import { UnsupportedFieldDataTypeError } from '../../domain/errors/SchemaErrors.js';

/**
 * Tipi di dato riconosciuti dal compiler, raggruppati per famiglia.
 * Qualunque data_type non presente in queste liste causa un errore esplicito.
 */
const STRING_TYPES = new Set(['string', 'text', 'varchar']);
const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);
const BOOLEAN_TYPES = new Set(['boolean']);
const DATE_TYPES = new Set(['date', 'datetime', 'timestamp']);
const UUID_TYPES = new Set(['uuid']);
const JSON_TYPES = new Set(['json']);
const ARRAY_TYPES = new Set(['array']);
const ENUM_TYPES = new Set(['enum']);
const RELATION_TYPES = new Set(['relation']);
const ATTACHMENT_TYPES = new Set(['file', 'image']);

/**
 * Compilatore puro: trasforma una lista di TypeFieldDefinition in uno z.ZodObject.
 *
 * Responsabilità:
 * - Mappare dataType a validatori Zod.
 * - Applicare vincoli (min, max, enum, regex, ecc.).
 * - Gestire required/optional.
 *
 * NON ha dipendenze infrastrutturali (niente DB, niente IO).
 * Sincrono e testabile in isolamento.
 */
export class FieldSchemaCompiler {
  /**
   * Compila una lista di definizioni di campo in uno schema Zod.
   * @param fields Le definizioni dei campi da compilare.
   * @param typeKey Il typeKey del tipo, usato solo per i messaggi di errore.
   * @throws UnsupportedFieldDataTypeError se un campo ha un dataType non riconosciuto.
   */
  compile(fields: readonly TypeFieldDefinition[], typeKey: string): z.ZodObject<z.ZodRawShape> {
    const shape: z.ZodRawShape = {};

    for (const field of fields) {
      shape[field.fieldKey] = this.compileField(field, typeKey);
    }

    return z.object(shape);
  }

  private compileField(field: TypeFieldDefinition, typeKey: string): z.ZodTypeAny {
    let validator = this.compileBaseType(field, typeKey);

    if (!field.isRequired) {
      validator = validator.optional().nullable();
    }

    return validator;
  }

  private compileBaseType(field: TypeFieldDefinition, typeKey: string): z.ZodTypeAny {
    const dt = field.dataType.toLowerCase();

    if (STRING_TYPES.has(dt)) {
      return this.compileStringField(field);
    }
    if (NUMBER_TYPES.has(dt)) {
      return this.compileNumberField(field);
    }
    if (BOOLEAN_TYPES.has(dt)) {
      return z.boolean();
    }
    if (DATE_TYPES.has(dt)) {
      return z.coerce.date();
    }
    if (UUID_TYPES.has(dt)) {
      return z.string().uuid();
    }
    if (JSON_TYPES.has(dt)) {
      return z.unknown();
    }
    if (ARRAY_TYPES.has(dt)) {
      return z.array(z.unknown());
    }
    if (ENUM_TYPES.has(dt)) {
      if (field.enumOptions.length > 0) {
        const values = field.enumOptions.filter((option) => option.isActive).map((option) => option.value);
        if (values.length > 0) return z.enum(values as [string, ...string[]]);
      }
      return this.compileStringField(field);
    }
    if (RELATION_TYPES.has(dt)) {
      const identifier = z.string().uuid();
      return field.relationSourceCardinality === 'many'
        ? z.array(identifier).min(field.isRequired ? 1 : 0)
        : identifier;
    }
    if (ATTACHMENT_TYPES.has(dt)) {
      // File content is stored in resource_attachments, not in the resource payload.
      return z.unknown();
    }

    throw new UnsupportedFieldDataTypeError(field.fieldKey, field.dataType, typeKey);
  }

  private compileStringField(field: TypeFieldDefinition): z.ZodTypeAny {
    // Cerchiamo prima un vincolo enum: se presente, ha precedenza sui vincoli di lunghezza
    const enumConstraint = field.constraints.find((c) => c.constraintType === 'enum');
    if (enumConstraint) {
      const parts = enumConstraint.value.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
      if (parts.length > 0) {
        return z.enum(parts as [string, ...string[]]);
      }
    }

    let strVal = z.string();
    for (const constraint of field.constraints) {
      if (constraint.constraintType === 'min_length') {
        strVal = strVal.min(parseInt(constraint.value, 10));
      }
      if (constraint.constraintType === 'max_length') {
        strVal = strVal.max(parseInt(constraint.value, 10));
      }
      if (constraint.constraintType === 'regex') {
        strVal = strVal.regex(new RegExp(constraint.value));
      }
    }
    return strVal;
  }

  private compileNumberField(field: TypeFieldDefinition): z.ZodTypeAny {
    let numVal = z.number();
    for (const constraint of field.constraints) {
      if (constraint.constraintType === 'min') {
        numVal = numVal.gte(parseFloat(constraint.value));
      }
      if (constraint.constraintType === 'max') {
        numVal = numVal.lte(parseFloat(constraint.value));
      }
    }
    return numVal;
  }
}
