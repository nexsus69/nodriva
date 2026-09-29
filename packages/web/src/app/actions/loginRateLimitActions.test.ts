/** Covers the narrow server boundary for source-address rate-limit administration. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  getSourceAddressRateLimitStatus: vi.fn(),
  releaseSourceAddressLoginRateLimit: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  authApplicationService: {
    getSourceAddressRateLimitStatus: mocks.getSourceAddressRateLimitStatus,
    releaseSourceAddressLoginRateLimit: mocks.releaseSourceAddressLoginRateLimit,
  },
}));
vi.mock('./auth/AuthResolver', () => ({ AuthResolver: { resolveActorUserId: mocks.resolveActorUserId } }));

import { getSourceLoginRateLimitAction, releaseSourceLoginRateLimitAction } from './loginRateLimitActions';

describe('source login-rate-limit actions', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset();
    mocks.getSourceAddressRateLimitStatus.mockReset();
    mocks.releaseSourceAddressLoginRateLimit.mockReset();
    mocks.resolveActorUserId.mockResolvedValue('admin-1');
  });

  it('returns only the active block expiry for the known source address', async () => {
    mocks.getSourceAddressRateLimitStatus.mockResolvedValue({ blockedUntil: '2026-01-01T00:15:00.000Z' });

    await expect(getSourceLoginRateLimitAction('203.0.113.42')).resolves.toEqual({ success: true, data: { blockedUntil: '2026-01-01T00:15:00.000Z' } });
    expect(mocks.getSourceAddressRateLimitStatus).toHaveBeenCalledWith('admin-1', '203.0.113.42');
  });

  it('keeps authorization failures structured and does not release the block', async () => {
    mocks.releaseSourceAddressLoginRateLimit.mockRejectedValue(new ForbiddenError());

    await expect(releaseSourceLoginRateLimitAction('203.0.113.42')).resolves.toMatchObject({ success: false, error: { code: 'ACCESS_FORBIDDEN' } });
  });
});
