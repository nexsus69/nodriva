import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookAccountActionDelivery } from './WebhookAccountActionDelivery';

describe('WebhookAccountActionDelivery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a bounded request and sends the secret only as authorization', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    const delivery = new WebhookAccountActionDelivery('https://mail.example.test/deliver', 'https://app.example.test', 'secret', 1_000);

    await delivery.deliver({ email: 'operator@example.test', purpose: 'password_reset', token: 'one-time-token', expiresAt: new Date('2026-09-01T12:00:00.000Z') });

    expect(fetch).toHaveBeenCalledWith('https://mail.example.test/deliver', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer secret' }),
      signal: expect.any(AbortSignal),
    }));
  });
});
