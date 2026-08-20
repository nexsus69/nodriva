import { describe, expect, it, vi } from 'vitest';
import { toClientErrorResponse } from './clientError';

describe('toClientErrorResponse', () => {
  it('preserves errors already sanitized by the server boundary', () => {
    const report = vi.fn();
    const error = { code: 'ACCESS_FORBIDDEN', message: 'Accesso negato.' };

    expect(toClientErrorResponse(error, 'Fallback', report)).toBe(error);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports and hides unexpected runtime details', () => {
    const report = vi.fn();
    const reason = new Error('database host leaked');

    expect(toClientErrorResponse(reason, 'Servizio non disponibile.', report)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Servizio non disponibile.',
    });
    expect(report).toHaveBeenCalledWith('[ClientError] Unexpected client or transport error:', reason);
  });
});
