import { AppError } from './AppError.js';

export class RoleNotFoundError extends AppError {
  constructor(roleKeyOrId: string) {
    super(`Role '${roleKeyOrId}' not found.`, 'ROLE_NOT_FOUND', { roleKeyOrId });
  }
}

export class RoleKeyAlreadyExistsError extends AppError {
  constructor(roleKey: string) {
    super(`Role key '${roleKey}' already exists.`, 'DUPLICATE_ROLE_KEY', { roleKey });
  }
}

export class SystemRoleForbiddenError extends AppError {
  constructor(roleKey: string) {
    super(`System role '${roleKey}' cannot be modified or deleted.`, 'SYSTEM_ROLE_FORBIDDEN', { roleKey });
  }
}

export class SecurityAdminValidationError extends AppError {
  constructor(message: string, issues?: Record<string, string[]>) {
    super(message, 'SECURITY_ADMIN_VALIDATION_ERROR', { issues });
  }
}
