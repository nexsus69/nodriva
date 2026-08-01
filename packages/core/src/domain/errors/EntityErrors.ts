import { AppError } from './AppError.js';

export class EntityNotFoundError extends AppError {
  constructor(entityId: string, cause?: unknown) {
    super('ENTITY_NOT_FOUND', `Entity with ID '${entityId}' was not found.`, { entityId }, cause);
  }
}

export class EntityTypeNotFoundError extends AppError {
  constructor(identifier: string, by: 'key' | 'id' = 'key', cause?: unknown) {
    super(
      'ENTITY_TYPE_NOT_FOUND',
      `Entity type with ${by} '${identifier}' was not found.`,
      { [by]: identifier },
      cause
    );
  }
}

export class EntitySchemaValidationError extends AppError {
  constructor(message: string, issues: Record<string, string[]>, cause?: unknown) {
    super('ENTITY_SCHEMA_VALIDATION_FAILED', message, { issues }, cause);
  }
}

export class EntityCommandValidationError extends AppError {
  constructor(message: string, issues: Record<string, string[]>, cause?: unknown) {
    super('ENTITY_COMMAND_VALIDATION_FAILED', message, { issues }, cause);
  }
}
