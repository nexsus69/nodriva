import { describe, it, expect } from 'vitest';
import { PasswordHasher } from './PasswordHasher.js';

describe('PasswordHasher', () => {
  it('should hash a password returning a salt:hash string', () => {
    const hashed = PasswordHasher.hash('password123');
    expect(hashed).toContain(':');
    const parts = hashed.split(':');
    expect(parts.length).toBe(2);
    expect(parts[0]?.length).toBeGreaterThan(0); // salt
    expect(parts[1]?.length).toBeGreaterThan(0); // hash
  });

  it('should verify a valid password', () => {
    const hashed = PasswordHasher.hash('my_secure_password');
    const isValid = PasswordHasher.verify('my_secure_password', hashed);
    expect(isValid).toBe(true);
  });

  it('should fail verification for wrong password', () => {
    const hashed = PasswordHasher.hash('my_secure_password');
    const isValid = PasswordHasher.verify('wrong_password', hashed);
    expect(isValid).toBe(false);
  });

  it('should fail verification for invalid hash formats', () => {
    expect(PasswordHasher.verify('password', '')).toBe(false);
    expect(PasswordHasher.verify('password', 'invalid_format_no_colon')).toBe(false);
    expect(PasswordHasher.verify('password', 'salt:')).toBe(false);
    expect(PasswordHasher.verify('password', ':hash')).toBe(false);
  });

  it('should fail verification if someone alters the hash', () => {
    const hashed = PasswordHasher.hash('password123');
    const altered = hashed.slice(0, -2) + '00';
    expect(PasswordHasher.verify('password123', altered)).toBe(false);
  });
});
