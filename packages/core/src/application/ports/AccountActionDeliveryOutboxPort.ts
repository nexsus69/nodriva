/** Defines durable, idempotent delivery work for account-action messages. */
import type { AccountActionPurpose } from './AccountActionTokenPort.js';

export interface PendingAccountActionDelivery {
  id: string;
  email: string;
  purpose: AccountActionPurpose;
  tokenCiphertext: string;
  expiresAt: Date;
}

export interface AccountActionDeliveryOutboxPort {
  enqueue(input: PendingAccountActionDelivery): Promise<void>;
  claimPending(workerId: string, limit: number): Promise<PendingAccountActionDelivery[]>;
  markDelivered(id: string, workerId: string): Promise<void>;
  markFailed(id: string, workerId: string, error: string): Promise<void>;
}
