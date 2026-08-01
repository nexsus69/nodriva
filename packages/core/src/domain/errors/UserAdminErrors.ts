import { AppError } from './AppError.js';

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User with ID '${userId}' not found.`, 'USER_NOT_FOUND', { userId });
  }
}

export class UserEmailAlreadyExistsError extends AppError {
  constructor(email: string) {
    super(`User with email '${email}' already exists.`, 'USER_EMAIL_ALREADY_EXISTS', { email });
  }
}

export class UserAdminValidationError extends AppError {
  constructor(message: string, issues?: Record<string, string[]>) {
    super(message, 'USER_ADMIN_VALIDATION_ERROR', { issues });
  }
}
