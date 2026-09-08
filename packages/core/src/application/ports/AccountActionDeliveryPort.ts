import type { AccountActionPurpose } from './AccountActionTokenPort.js';

export interface AccountActionDeliveryPort {
  /** `idempotencyKey` is stable across retries of the same durable outbox row. */
  deliver(input: { idempotencyKey: string; email: string; purpose: AccountActionPurpose; token: string; expiresAt: Date }): Promise<void>;
}
