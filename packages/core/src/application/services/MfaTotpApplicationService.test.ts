import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { MfaTotpApplicationService } from './MfaTotpApplicationService.js';
import type { MfaTotpPort, MfaTotpRecord } from '../ports/MfaTotpPort.js';
import type { AuditPort } from '../ports/AuditPort.js';

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
  it('encrypts enrollment secrets, verifies TOTP and stores only hashed recovery codes', async () => {
    let record: MfaTotpRecord | null = null;
    const mfa: MfaTotpPort = {
      findByUserId: vi.fn(async () => record),
      savePending: vi.fn(async (userId, secretCiphertext) => {
        record = { userId, secretCiphertext, enabledAt: null, recoveryCodeHashes: [] };
      }),
      enable: vi.fn(async (_userId, recoveryCodeHashes, enabledAt) => {
        record = { ...record!, enabledAt, recoveryCodeHashes };
      }),
      consumeRecoveryCode: vi.fn().mockResolvedValue(false),
      deleteForUser: vi.fn(),
    };
    const audit: AuditPort = { record: vi.fn() };
    const key = crypto.randomBytes(32).toString('base64');
    const service = new MfaTotpApplicationService(mfa, audit, key);

    const enrollment = await service.beginEnrollment('user-1', 'admin@example.test');
    expect(record!.secretCiphertext).not.toContain(enrollment.secret);
    const codes = await service.confirmEnrollment('user-1', currentCode(enrollment.secret));

    expect(codes).toHaveLength(10);
    expect(record!.recoveryCodeHashes).toHaveLength(10);
    expect(record!.recoveryCodeHashes).not.toContain(codes[0]);
    await expect(service.verifyLogin('user-1', currentCode(enrollment.secret))).resolves.toBeUndefined();
  });

  it('fails closed when an enabled factor has no code', async () => {
    const mfa: MfaTotpPort = {
      findByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', secretCiphertext: 'invalid', enabledAt: new Date(), recoveryCodeHashes: [] }),
      savePending: vi.fn(), enable: vi.fn(), consumeRecoveryCode: vi.fn(), deleteForUser: vi.fn(),
    };
    const service = new MfaTotpApplicationService(mfa, { record: vi.fn() }, crypto.randomBytes(32).toString('base64'));
    await expect(service.verifyLogin('user-1')).rejects.toThrow('Invalid credentials');
  });
});
