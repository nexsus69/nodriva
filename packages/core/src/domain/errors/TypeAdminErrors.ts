import { AppError } from './AppError.js';
import { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';

export class TypeAdminValidationError extends AppError {
  constructor(message: string, issues: Record<string, string[]>, cause?: unknown) {
    super('TYPE_ADMIN_VALIDATION_FAILED', message, { issues }, cause);
  }
}

export class TypeDefinitionNotFoundError extends AppError {
  constructor(identifier: string, domain: TypeDomain, cause?: unknown) {
    super(
      'TYPE_DEFINITION_NOT_FOUND',
      `Type definition '${identifier}' not found in domain '${domain}'.`,
      { identifier, domain },
      cause
    );
  }
}

export class TypeFieldNotFoundError extends AppError {
  constructor(fieldId: string, domain: TypeDomain, cause?: unknown) {
    super(
      'TYPE_FIELD_NOT_FOUND',
      `Type field '${fieldId}' not found in domain '${domain}'.`,
      { fieldId, domain },
      cause
    );
  }
}

export class TypeFieldConstraintNotFoundError extends AppError {
  constructor(constraintId: string, domain: TypeDomain, cause?: unknown) {
    super(
      'TYPE_FIELD_CONSTRAINT_NOT_FOUND',
      `Type field constraint '${constraintId}' not found in domain '${domain}'.`,
      { constraintId, domain },
      cause
    );
  }
}

export class TypeKeyAlreadyExistsError extends AppError {
  constructor(typeKey: string, domain: TypeDomain, cause?: unknown) {
    super(
      'TYPE_KEY_ALREADY_EXISTS',
      `A type with key '${typeKey}' already exists in domain '${domain}'.`,
      { typeKey, domain },
      cause
    );
  }
}

export class TypeFieldKeyAlreadyExistsError extends AppError {
  constructor(fieldKey: string, typeId: string, domain: TypeDomain, cause?: unknown) {
    super(
      'TYPE_FIELD_KEY_ALREADY_EXISTS',
      `A field with key '${fieldKey}' already exists in type '${typeId}' (domain '${domain}').`,
      { fieldKey, typeId, domain },
      cause
    );
  }
}

export class TypeFieldColumnNameAlreadyExistsError extends AppError {
  constructor(columnName: string, typeId: string, domain: TypeDomain, cause?: unknown) {
    super(
      'TYPE_FIELD_COLUMN_NAME_ALREADY_EXISTS',
      `A field with column name '${columnName}' already exists in type '${typeId}' (domain '${domain}').`,
      { columnName, typeId, domain },
      cause
    );
  }
}

export class SystemTypeModificationError extends AppError {
  constructor(typeKey: string, domain: TypeDomain, cause?: unknown) {
    super(
      'SYSTEM_TYPE_MODIFICATION_DENIED',
      `Cannot modify system type '${typeKey}' in domain '${domain}'.`,
      { typeKey, domain },
      cause
    );
  }
}

export class SystemFieldModificationError extends AppError {
  constructor(fieldId: string, domain: TypeDomain, cause?: unknown) {
    super(
      'SYSTEM_FIELD_MODIFICATION_DENIED',
      `Cannot modify system field '${fieldId}' in domain '${domain}'.`,
      { fieldId, domain },
      cause
    );
  }
}

export class TypeHasInstancesError extends AppError {
  constructor(typeId: string, domain: TypeDomain, operation: string, cause?: unknown) {
    super(
      'TYPE_HAS_INSTANCES',
      `Cannot ${operation} type '${typeId}' in domain '${domain}': existing instances found.`,
      { typeId, domain, operation },
      cause
    );
  }
}
