/** Verifies encrypted TOTP enrollment, replacement and recovery behavior. */
import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { MfaTotpApplicationService } from './MfaTotpApplicationService.js';
import type { MfaTotpPort, MfaTotpRecord } from '../ports/MfaTotpPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value: string): Buffer {
  const bits = [...value].map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function currentCode(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

describe('MfaTotpApplicationService', () => {
  const transactions: TransactionPort = {
    runInTransaction: async (work) => work(),
    runInAuthorizationMutation: async (work) => work(),
  };
  it('encrypts enrollment secrets, verifies TOTP and stores only hashed recovery codes', async () => {
    let record: MfaTotpRecord | null = null;
    const mfa: MfaTotpPort = {
      findByUserId: vi.fn(async () => record),
      savePending: vi.fn(async (userId, pendingSecretCiphertext, pendingExpiresAt) => {
        record = { userId, secretCiphertext: pendingSecretCiphertext, enabledAt: null, recoveryCodeHashes: [], pendingSecretCiphertext, pendingExpiresAt };
      }),
      promotePending: vi.fn(async (_userId, recoveryCodeHashes, enabledAt) => {
        record = { ...record!, secretCiphertext: record!.pendingSecretCiphertext!, enabledAt, recoveryCodeHashes, pendingSecretCiphertext: null, pendingExpiresAt: null };
        return true;
      }),
      consumeRecoveryCode: vi.fn().mockResolvedValue(false),
      deleteForUser: vi.fn(),
    };
    const audit: AuditPort = { record: vi.fn() };
    const key = crypto.randomBytes(32).toString('base64');
    const service = new MfaTotpApplicationService(mfa, audit, transactions, key);

    const enrollment = await service.beginEnrollment('user-1', 'admin@example.test');
    expect(record!.pendingSecretCiphertext).not.toContain(enrollment.secret);
    const codes = await service.confirmEnrollment('user-1', currentCode(enrollment.secret));

    expect(codes).toHaveLength(10);
    expect(record!.recoveryCodeHashes).toHaveLength(10);
    expect(record!.recoveryCodeHashes).not.toContain(codes[0]);
    await expect(service.verifyLogin('user-1', currentCode(enrollment.secret))).resolves.toBeUndefined();
  });

  it('fails closed when an enabled factor has no code', async () => {
    const mfa: MfaTotpPort = {
      findByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', secretCiphertext: 'invalid', enabledAt: new Date(), recoveryCodeHashes: [], pendingSecretCiphertext: null, pendingExpiresAt: null }),
      savePending: vi.fn(), promotePending: vi.fn(), consumeRecoveryCode: vi.fn(), deleteForUser: vi.fn(),
    };
    const service = new MfaTotpApplicationService(mfa, { record: vi.fn() }, transactions, crypto.randomBytes(32).toString('base64'));
    await expect(service.verifyLogin('user-1')).rejects.toThrow('Invalid credentials');
  });

  it('keeps the active factor enabled while a replacement remains pending', async () => {
    let record: MfaTotpRecord | null = null;
    const mfa: MfaTotpPort = {
      findByUserId: vi.fn(async () => record),
      savePending: vi.fn(async (_userId, pendingSecretCiphertext, pendingExpiresAt) => {
        record = { ...record!, pendingSecretCiphertext, pendingExpiresAt };
      }),
      promotePending: vi.fn(), consumeRecoveryCode: vi.fn().mockResolvedValue(false), deleteForUser: vi.fn(),
    };
    const service = new MfaTotpApplicationService(mfa, { record: vi.fn() }, transactions, crypto.randomBytes(32).toString('base64'));
    const initial = await service.beginEnrollment('user-1', 'admin@example.test');
    await mfa.promotePending('user-1', [], new Date());
    record = { ...record!, secretCiphertext: record!.pendingSecretCiphertext!, enabledAt: new Date(), pendingSecretCiphertext: null, pendingExpiresAt: null };

    await service.beginEnrollment('user-1', 'admin@example.test', currentCode(initial.secret));

    expect(record?.enabledAt).toBeInstanceOf(Date);
    await expect(service.verifyLogin('user-1', currentCode(initial.secret))).resolves.toBeUndefined();
  });
});
