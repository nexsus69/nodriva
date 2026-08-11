import { describe, expect, it } from 'vitest';
import { EncryptionKeyring } from './EncryptionKeyring.js';

describe('EncryptionKeyring', () => {
  it('uses the active version for new encryption and keeps older versions readable', () => {
    const first = '11'.repeat(32);
    const second = '22'.repeat(32);
    const ring = new EncryptionKeyring(first, `v1=${first},v2=${second}`, 'v2', 'FIELD_ENCRYPTION_KEY');
    expect(ring.active().version).toBe('v2');
    expect(ring.get('v1')).toEqual(Buffer.from(first, 'hex'));
  });

  it('fails closed when the configured active version is absent', () => {
    const first = '11'.repeat(32);
    expect(() => new EncryptionKeyring(first, undefined, 'v2', 'FIELD_ENCRYPTION_KEY')).toThrow('active key version');
  });
});
