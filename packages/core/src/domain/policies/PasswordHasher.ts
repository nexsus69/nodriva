import crypto from 'crypto';

export class PasswordHasher {
  private static readonly KEY_LENGTH = 64;
  private static readonly SALT_LENGTH = 16;
  
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
    } catch (err) {
      return false;
    }
  }
}
