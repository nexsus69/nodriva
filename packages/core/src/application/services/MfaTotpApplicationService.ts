import crypto from 'crypto';
import { AuditPort } from '../ports/AuditPort.js';
import { MfaTotpPort } from '../ports/MfaTotpPort.js';
import { UnauthorizedError, ValidationError } from '../../domain/errors/ApplicationErrors.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(value: Buffer): string {
  let bits = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let offset = 0; offset < bits.length; offset += 5) {
    result += BASE32_ALPHABET[Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function decodeBase32(value: string): Buffer {
  let bits = '';
  for (const character of value.replace(/=+$/g, '').toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

export class MfaTotpApplicationService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly mfa: MfaTotpPort, private readonly audit: AuditPort, encryptionKey: string) {
    this.encryptionKey = Buffer.from(encryptionKey, 'base64');
    if (this.encryptionKey.length !== 32) {
      throw new Error('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
  }

  async beginEnrollment(userId: string, email: string, currentCode?: string): Promise<{ secret: string; otpauthUri: string }> {
    const existing = await this.mfa.findByUserId(userId);
    if (existing?.enabledAt) {
      if (!currentCode || !this.verifyTotp(this.decrypt(existing.secretCiphertext), currentCode.trim())) {
        throw new UnauthorizedError('A valid current MFA code is required to replace the factor.');
      }
    }
    const secret = encodeBase32(crypto.randomBytes(20));
    await this.mfa.savePending(userId, this.encrypt(secret));
    const label = encodeURIComponent(`Dashboard:${email}`);
    const issuer = encodeURIComponent('Dashboard');
    return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
  }

  async confirmEnrollment(userId: string, code: string): Promise<string[]> {
    const record = await this.mfa.findByUserId(userId);
    if (!record || !this.verifyTotp(this.decrypt(record.secretCiphertext), code)) {
      throw new UnauthorizedError('Invalid MFA code');
    }
    const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(6).toString('hex').toUpperCase());
    await this.mfa.enable(userId, recoveryCodes.map((item) => this.hash(item)), new Date());
    await this.audit.record(userId, 'user.mfa_enabled', 'user', userId, null, null, null);
    return recoveryCodes;
  }

  async verifyLogin(userId: string, code?: string): Promise<void> {
    const record = await this.mfa.findByUserId(userId);
    if (!record?.enabledAt) return;
    if (!code) throw new UnauthorizedError('Invalid credentials');
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    if (/^\d{6}$/.test(normalized) && this.verifyTotp(this.decrypt(record.secretCiphertext), normalized)) return;
    if (await this.mfa.consumeRecoveryCode(userId, this.hash(normalized))) {
      await this.audit.record(userId, 'user.mfa_recovery_used', 'user', userId, null, null, null);
      return;
    }
    throw new UnauthorizedError('Invalid credentials');
  }

  async disable(userId: string, code: string): Promise<void> {
    await this.verifyLogin(userId, code);
    await this.mfa.deleteForUser(userId);
    await this.audit.record(userId, 'user.mfa_disabled', 'user', userId, null, null, null);
  }

  private verifyTotp(secret: string, code: string, now = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    for (const drift of [-1, 0, 1]) {
      const counter = Math.floor(now / 30_000) + drift;
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64BE(BigInt(counter));
      const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
      const offset = digest[digest.length - 1]! & 0x0f;
      const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
      const candidate = binary.toString().padStart(6, '0');
      if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
    }
    return false;
  }

  private encrypt(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
  }

  private decrypt(value: string): string {
    const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part!, 'base64url'));
    if (!iv || !tag || !ciphertext) throw new ValidationError('Stored MFA secret is invalid.', { mfa: ['Invalid encrypted secret.'] });
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
