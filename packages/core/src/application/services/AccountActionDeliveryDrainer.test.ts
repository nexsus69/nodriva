/** Verifies retry-safe delivery of account action outbox work. */
import { describe, expect, it, vi } from 'vitest';
import { AccountActionDeliveryDrainer } from './AccountActionDeliveryDrainer.js';
import type { AccountActionDeliveryOutboxPort } from '../ports/AccountActionDeliveryOutboxPort.js';
import type { AccountActionTokenCipherPort } from '../ports/AccountActionTokenCipherPort.js';
import type { AccountActionDeliveryPort } from '../ports/AccountActionDeliveryPort.js';

describe('AccountActionDeliveryDrainer', () => {
  it('marks a failed delivery retryable and reuses its idempotency key on retry', async () => {
    const item = { id: 'delivery-1', email: 'person@example.test', purpose: 'password_reset' as const, tokenCiphertext: 'ciphertext', expiresAt: new Date('2026-09-01T12:00:00Z') };
    const outbox: AccountActionDeliveryOutboxPort = {
      enqueue: vi.fn(), claimPending: vi.fn().mockResolvedValueOnce([item]).mockResolvedValueOnce([item]), markDelivered: vi.fn(), markFailed: vi.fn(),
    };
    const cipher: AccountActionTokenCipherPort = { encrypt: vi.fn(), decrypt: vi.fn().mockReturnValue('plain-token') };
    const delivery: AccountActionDeliveryPort = { deliver: vi.fn().mockRejectedValueOnce(new Error('mail down')).mockResolvedValueOnce(undefined) };
    const drainer = new AccountActionDeliveryDrainer(outbox, cipher, delivery, 'worker-1');

    await expect(drainer.drain()).resolves.toBe(1);
    expect(outbox.markFailed).toHaveBeenCalledWith('delivery-1', 'worker-1', 'mail down');
    await expect(drainer.drain()).resolves.toBe(1);
    expect(delivery.deliver).toHaveBeenLastCalledWith(expect.objectContaining({ idempotencyKey: 'delivery-1', token: 'plain-token' }));
    expect(outbox.markDelivered).toHaveBeenCalledWith('delivery-1', 'worker-1');
  });
});
