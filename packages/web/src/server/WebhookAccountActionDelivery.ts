/** Delivers account actions through a bounded external webhook request. */
import type { AccountActionDeliveryPort } from '@dashboard/core';

export class WebhookAccountActionDelivery implements AccountActionDeliveryPort {
  constructor(
    private readonly endpoint: string,
    private readonly publicBaseUrl: string,
    private readonly secret?: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async deliver(input: Parameters<AccountActionDeliveryPort['deliver']>[0]): Promise<void> {
    const url = new URL('/account/complete', this.publicBaseUrl);
    url.searchParams.set('token', input.token);
    url.searchParams.set('purpose', input.purpose);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.secret ? { authorization: `Bearer ${this.secret}` } : {}),
        },
        body: JSON.stringify({
          to: input.email,
          template: input.purpose,
          actionUrl: url.toString(),
          expiresAt: input.expiresAt.toISOString(),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Account action delivery failed with status ${response.status}.`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
