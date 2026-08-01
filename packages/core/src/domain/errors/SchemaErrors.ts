import { AppError } from './AppError.js';

/**
 * Errore lanciato dal compiler quando incontra un data_type non supportato.
 * Non è un errore di validazione: è un'incoerenza nei metadati del tipo.
 */
export class UnsupportedFieldDataTypeError extends AppError {
  constructor(fieldKey: string, dataType: string, typeKey: string, cause?: unknown) {
    super(
      'UNSUPPORTED_FIELD_DATA_TYPE',
      `Field '${fieldKey}' in type '${typeKey}' has unsupported data type '${dataType}'. ` +
        `Schema compilation aborted.`,
      { fieldKey, dataType, typeKey },
      cause
    );
  }
}

/**
 * Errore generico di compilazione schema, per casi non coperti da errori più specifici.
 */
export class SchemaCompilationError extends AppError {
  constructor(typeKey: string, reason: string, cause?: unknown) {
    super(
      'SCHEMA_COMPILATION_ERROR',
      `Failed to compile schema for type '${typeKey}': ${reason}`,
      { typeKey, reason },
      cause
    );
  }
}
