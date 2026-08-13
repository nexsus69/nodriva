import { describe, expect, it, vi } from 'vitest';
import { requestActivity } from './activityProtocol';

describe('requestActivity', () => {
  it('classifies an explicit unauthorized response as expired', async () => {
    const response = new Response(null, { status: 401 });

    await expect(requestActivity('/api/activity', undefined, vi.fn().mockResolvedValue(response)))
      .resolves.toMatchObject({ outcome: 'expired', response });
  });

  it('classifies a redirect to login as expired', async () => {
    const response = {
      ok: true,
      status: 200,
      redirected: true,
      url: 'https://dashboard.test/login?error=SessionExpired',
    } as Response;

    await expect(requestActivity('/api/activity', undefined, vi.fn().mockResolvedValue(response)))
      .resolves.toMatchObject({ outcome: 'expired', response });
  });

  it('classifies server failures as unreachable without expiring the session', async () => {
    const response = new Response(null, { status: 503 });

    await expect(requestActivity('/api/activity', undefined, vi.fn().mockResolvedValue(response)))
      .resolves.toMatchObject({ outcome: 'unreachable', response });
  });

  it('classifies network failures as unreachable without a response', async () => {
    const result = await requestActivity(
      '/api/activity',
      undefined,
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    expect(result).toEqual({ outcome: 'unreachable' });
  });

  it('returns successful responses for normal processing', async () => {
    const response = Response.json({ sessionExpiresAt: '2026-08-13T22:00:00.000Z' });

    await expect(requestActivity('/api/activity', undefined, vi.fn().mockResolvedValue(response)))
      .resolves.toMatchObject({ outcome: 'success', response });
  });
});
