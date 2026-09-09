/** Verifies public recovery errors without leaking transport or database details. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, ValidationError } from '@dashboard/core';
import { completeAccountActionAction } from './accountRecoveryActions';

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock('../../server/db', () => ({ accountRecoveryService: { complete } }));
vi.mock('./auth/AuthResolver', () => ({ AuthResolver: {} }));
afterEach(() => { vi.restoreAllMocks(); complete.mockReset(); });

describe('account completion error boundary', () => {
  it('reports successful completion', async () => {
    complete.mockResolvedValue(undefined);
    await expect(completeAccountActionAction('token', 'password')).resolves.toEqual({ success: true });
  });

  it('maps a rejected token to the public link message', async () => {
    complete.mockRejectedValue(new UnauthorizedError('Invalid or expired account action'));
    await expect(completeAccountActionAction('token', 'password')).resolves.toEqual({
      success: false, error: 'Il link non è valido, è scaduto o è già stato utilizzato.',
    });
  });

  it('recognizes password validation by domain code rather than message text', async () => {
    complete.mockRejectedValue(new ValidationError('Different internal wording', { password: ['weak'] }));
    await expect(completeAccountActionAction('token', 'password')).resolves.toEqual({
      success: false, error: 'La password non rispetta i requisiti indicati.',
    });
  });

  it.each([new Error('connection failed at private-db:5432'), new Error('Invalid password.')])(
    'reports infrastructure failures as internal errors even if the message resembles validation', async (error) => {
      const report = vi.spyOn(console, 'error').mockImplementation(() => {});
      complete.mockRejectedValue(error);
      await expect(completeAccountActionAction('secret-token', 'secret-password')).resolves.toEqual({
        success: false, error: 'Si è verificato un errore interno. Riprova più tardi.',
      });
      expect(report).toHaveBeenCalledOnce();
    },
  );
});
