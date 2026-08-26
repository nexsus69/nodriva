// Purpose: verifies safe, structured outcomes for administrative bootstrap actions.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  assertIsSuperAdmin: vi.fn(),
  seedDatabase: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  accessControlPort: { assertIsSuperAdmin: mocks.assertIsSuperAdmin },
  systemSeedService: { seedDatabase: mocks.seedDatabase },
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: { resolveActorUserId: mocks.resolveActorUserId },
}));

import { seedDatabaseAction } from './seedAction';

describe('seedDatabaseAction', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset().mockResolvedValue('admin-1');
    mocks.assertIsSuperAdmin.mockReset().mockResolvedValue(undefined);
    mocks.seedDatabase.mockReset().mockResolvedValue(undefined);
  });

  it('returns a validation result when the explicit confirmation is invalid', async () => {
    await expect(seedDatabaseAction('wrong confirmation')).resolves.toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(mocks.seedDatabase).not.toHaveBeenCalled();
  });

  it('returns an authorization result instead of rejecting the bootstrap screen', async () => {
    mocks.assertIsSuperAdmin.mockRejectedValue(new ForbiddenError());

    await expect(seedDatabaseAction('INITIALIZE SYSTEM')).resolves.toMatchObject({
      success: false,
      error: { code: 'ACCESS_FORBIDDEN' },
    });
  });

  it('keeps unexpected bootstrap failures generic and safe for the client', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.seedDatabase.mockRejectedValue(new Error('database host leaked'));

    await expect(seedDatabaseAction('INITIALIZE SYSTEM')).resolves.toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Si è verificato un errore interno. Riprova più tardi.' },
    });
    expect(report).toHaveBeenCalled();
    report.mockRestore();
  });
});
