import { randomUUID } from 'node:crypto';
import type { AccountActionDeliveryOutboxPort } from '../ports/AccountActionDeliveryOutboxPort.js';
import type { AccountActionDeliveryPort } from '../ports/AccountActionDeliveryPort.js';
import type { AccountActionTokenCipherPort } from '../ports/AccountActionTokenCipherPort.js';

/** Delivers leased account actions after commit; a durable row makes retries safe. */
export class AccountActionDeliveryDrainer {
  constructor(
    private readonly outbox: AccountActionDeliveryOutboxPort,
    private readonly cipher: AccountActionTokenCipherPort,
    private readonly delivery: AccountActionDeliveryPort,
    private readonly workerId = `account-action:${process.env.HOSTNAME ?? 'worker'}:${process.pid}:${randomUUID()}`,
  ) {}

  async drain(limit = 25): Promise<number> {
    const pending = await this.outbox.claimPending(this.workerId, limit);
    for (const item of pending) {
      try {
        await this.delivery.deliver({
          idempotencyKey: item.id,
          email: item.email,
          purpose: item.purpose,
          token: this.cipher.decrypt(item.tokenCiphertext),
          expiresAt: item.expiresAt,
        });
        await this.outbox.markDelivered(item.id, this.workerId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.outbox.markFailed(item.id, this.workerId, message);
      }
    }
    return pending.length;
  }
}
