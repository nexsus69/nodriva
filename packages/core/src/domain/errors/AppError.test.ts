import { describe, it, expect } from 'vitest';
import { AppError } from './AppError.js';
import { NodeNotFoundError } from './DomainErrors.js';
import { ValidationError } from './ApplicationErrors.js';

describe('AppError & Custom Errors', () => {
  it('should capture stack trace and correct properties', () => {
    const error = new AppError('TEST_CODE', 'Test message', { foo: 'bar' });
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.stack).toBeDefined();
    expect(error instanceof AppError).toBe(true);
  });

  it('should preserve the cause of the error', () => {
    const originalError = new Error('Database connection failed');
    const appError = new NodeNotFoundError('node-123', originalError);

    expect(appError.code).toBe('NODE_NOT_FOUND');
    expect(appError.cause).toBe(originalError);
    expect(appError.message).toContain('node-123');
  });

  it('should serialize details correctly', () => {
    const issues = { name: ['Name is required'] };
    const err = new ValidationError('Validation failed', issues);
    expect(err.details).toEqual({ issues });
  });
});
