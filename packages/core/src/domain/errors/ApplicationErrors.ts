import { AppError } from './AppError.js';

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication credentials are required or invalid.', cause?: unknown) {
    super('AUTH_UNAUTHORIZED', message, undefined, cause);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', details?: Record<string, unknown>, cause?: unknown) {
    super('ACCESS_FORBIDDEN', message, details, cause);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, issues: Record<string, string[]>, cause?: unknown) {
    super('VALIDATION_FAILED', message, { issues }, cause);
  }
}

export class CapabilityDisabledError extends AppError {
  constructor(capabilityKey: string, cause?: unknown) {
    super(
      'CAPABILITY_DISABLED',
      `The capability '${capabilityKey}' is currently disabled in the configuration.`,
      { capabilityKey },
      cause
    );
  }
}

export class LockConflictError extends AppError {
  constructor(resourceType: string, resourceId: string, cause?: unknown) {
    super(
      'LOCK_CONFLICT',
      `The resource of type '${resourceType}' with ID '${resourceId}' is currently locked by another user.`,
      { resourceType, resourceId },
      cause
    );
  }
}

export class LockNotFoundError extends AppError {
  constructor(resourceType: string, resourceId: string, cause?: unknown) {
    super(
      'LOCK_NOT_FOUND',
      `No lock found for resource of type '${resourceType}' with ID '${resourceId}'.`,
      { resourceType, resourceId },
      cause
    );
  }
}

export class LockExpiredError extends AppError {
  constructor(resourceType: string, resourceId: string, cause?: unknown) {
    super(
      'LOCK_EXPIRED',
      `The lock for resource of type '${resourceType}' with ID '${resourceId}' has expired.`,
      { resourceType, resourceId },
      cause
    );
  }
}

export class LockForbiddenError extends AppError {
  constructor(resourceType: string, resourceId: string, cause?: unknown) {
    super(
      'LOCK_FORBIDDEN',
      `You do not have permission to unlock the resource of type '${resourceType}' with ID '${resourceId}'.`,
      { resourceType, resourceId },
      cause
    );
  }
}
