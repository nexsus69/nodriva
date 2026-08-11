import { Buffer } from 'node:buffer';

export interface EncryptionKey {
  version: string;
  value: Buffer;
}

/**
 * Small deployment keyring. The active key is used only for new ciphertext;
 * previous versions remain available for decryption during rotation.
 * Format: `v1=<64 hex chars>,v2=<64 hex chars>`.
 */
export class EncryptionKeyring {
  private readonly keys: Map<string, Buffer>;

  constructor(
    primaryKeyHex: string | undefined,
    keyringSpec: string | undefined,
    private readonly activeVersion = 'v1',
    private readonly keyName = 'ENCRYPTION_KEY',
  ) {
    this.keys = new Map();
    if (primaryKeyHex) this.add('v1', primaryKeyHex);
    if (keyringSpec) {
      for (const item of keyringSpec.split(',')) {
        const [version, key] = item.trim().split('=', 2);
        if (!version || !key) throw new Error(`${this.keyName} keyring entries must use version=64-hex format`);
        this.add(version, key);
      }
    }
    if (this.keys.size > 0 && !this.keys.has(this.activeVersion)) {
      throw new Error(`${this.keyName} active key version '${this.activeVersion}' is not configured`);
    }
  }

  get hasKeys(): boolean { return this.keys.size > 0; }

  active(): EncryptionKey {
    const value = this.keys.get(this.activeVersion);
    if (!value) throw new Error(`${this.keyName} is missing`);
    return { version: this.activeVersion, value };
  }

  get(version: string): Buffer {
    const value = this.keys.get(version);
    if (!value) throw new Error(`${this.keyName} version '${version}' is not available`);
    return value;
  }

  private add(version: string, keyHex: string): void {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(version)) throw new Error(`${this.keyName} version is invalid`);
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error(`${this.keyName} must be a 32-byte hex key; keyring values must be 32-byte hex values`);
    this.keys.set(version, Buffer.from(keyHex, 'hex'));
  }
}
