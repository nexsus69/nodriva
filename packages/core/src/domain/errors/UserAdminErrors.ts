import { AppError } from './AppError.js';

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super('USER_NOT_FOUND', `User with ID '${userId}' not found.`, { userId });
  }
}

export class UserEmailAlreadyExistsError extends AppError {
  constructor(email: string) {
    super('USER_EMAIL_ALREADY_EXISTS', `User with email '${email}' already exists.`, { email });
  }
}

export class UserAdminValidationError extends AppError {
  constructor(message: string, issues?: Record<string, string[]>) {
    super('USER_ADMIN_VALIDATION_ERROR', message, { issues });
  }
}
