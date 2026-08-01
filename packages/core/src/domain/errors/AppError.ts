export class AppError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown> | undefined;
  override readonly cause?: unknown | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.cause = cause;
    
    Object.setPrototypeOf(this, new.target.prototype);
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
