/** Implements the password hashing port with Node scrypt and timing-safe comparison. */
import crypto from 'node:crypto';

export class PasswordHasher {
  private static readonly KEY_LENGTH = 64;
  private static readonly SALT_LENGTH = 16;
  private static readonly DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
  
  /**
   * Hashes a plaintext password using scryptSync.
   * Returns the serialized hash in the format 'saltHex:hashHex'.
   */
  static hash(password: string): string {
    const salt = crypto.randomBytes(this.SALT_LENGTH).toString('hex');
    const hash = crypto.scryptSync(password, salt, this.KEY_LENGTH).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifies a plaintext password against a stored hash (saltHex:hashHex).
   * Returns true if they match, false otherwise.
   */
  static verify(password: string, storedHash: string): boolean {
    if (!storedHash || !storedHash.includes(':')) return false;
    
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;

    try {
      const computedHash = crypto.scryptSync(password, salt, this.KEY_LENGTH).toString('hex');
      // Use timingSafeEqual to prevent timing attacks, converting to buffers first
      const storedBuffer = Buffer.from(hash, 'hex');
      const computedBuffer = Buffer.from(computedHash, 'hex');
      
      if (storedBuffer.length !== computedBuffer.length) return false;
      return crypto.timingSafeEqual(storedBuffer, computedBuffer);
    } catch {
      return false;
    }
  }

  static async verifyAsync(password: string, storedHash?: string): Promise<boolean> {
    const serializedHash = storedHash ?? this.DUMMY_HASH;
    const [salt, hash] = serializedHash.split(':');
    const safeSalt = salt || '0'.repeat(32);
    const expected = hash && /^[0-9a-f]+$/i.test(hash) ? Buffer.from(hash, 'hex') : Buffer.alloc(this.KEY_LENGTH);
    try {
      const computed = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(password, safeSalt, this.KEY_LENGTH, (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey);
        });
      });
      return expected.length === computed.length && crypto.timingSafeEqual(expected, computed);
    } catch {
      return false;
    }
  }
}
