import { AppError } from './AppError.js';

export class RoleNotFoundError extends AppError {
  constructor(roleKeyOrId: string) {
    super('ROLE_NOT_FOUND', `Role '${roleKeyOrId}' not found.`, { roleKeyOrId });
  }
}

export class RoleKeyAlreadyExistsError extends AppError {
  constructor(roleKey: string) {
    super('DUPLICATE_ROLE_KEY', `Role key '${roleKey}' already exists.`, { roleKey });
  }
}

export class SystemRoleForbiddenError extends AppError {
  constructor(roleKey: string) {
    super('SYSTEM_ROLE_FORBIDDEN', `System role '${roleKey}' cannot be modified or deleted.`, { roleKey });
  }
}

export class SecurityAdminValidationError extends AppError {
  constructor(message: string, issues?: Record<string, string[]>) {
    super('SECURITY_ADMIN_VALIDATION_ERROR', message, { issues });
  }
}
