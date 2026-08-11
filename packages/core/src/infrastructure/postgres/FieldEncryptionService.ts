import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ConfigService } from '../../application/services/ConfigService.js';
import type { PgExecutor } from './PgExecutor.js';
import { EncryptionKeyring } from '../crypto/EncryptionKeyring.js';

type ResourceType = 'node' | 'entity';
type Mode = 'plaintext' | 'encrypted';
const HEADER = 'DASHFIELD1';

export class FieldEncryptionService {
  private readonly keyring: EncryptionKeyring;

  constructor(private readonly executor: PgExecutor, private readonly config: ConfigService, keyHex = process.env.FIELD_ENCRYPTION_KEY ?? process.env.ATTACHMENTS_ENCRYPTION_KEY, keyringSpec = process.env.FIELD_ENCRYPTION_KEYS, activeVersion = process.env.FIELD_ENCRYPTION_ACTIVE_VERSION ?? 'v1') {
    this.keyring = new EncryptionKeyring(keyHex, keyringSpec, activeVersion, 'FIELD_ENCRYPTION_KEY');
  }

  async protect(resourceType: ResourceType, typeId: string, resourceId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const modes = await this.modes(resourceType, typeId);
    const globalEnabled = await this.config.get<boolean>('data.fieldsEncryptionEnabled');
    const result: Record<string, unknown> = { ...payload };
    for (const [fieldKey, mode] of modes) {
      const enabled = globalEnabled && mode === 'encrypted';
      if (!Object.prototype.hasOwnProperty.call(payload, fieldKey)) {
        // Entity/node updates carry the complete payload.  A missing encrypted
        // field therefore means that its value was cleared, and must not leave
        // a stale sidecar behind.
        await this.executor.query('DELETE FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2 AND field_key = $3', [resourceType, resourceId, fieldKey]);
        continue;
      }
      const value = payload[fieldKey];
      const isEmpty = value === null || value === '';
      if (enabled && !isEmpty) {
        const activeKey = this.keyring.active();
        await this.executor.query(
          `INSERT INTO resource_field_ciphertexts (resource_type, resource_id, field_key, key_version, ciphertext)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (resource_type, resource_id, field_key) DO UPDATE SET key_version = EXCLUDED.key_version, ciphertext = EXCLUDED.ciphertext, updated_at = NOW()`,
          [resourceType, resourceId, fieldKey, activeKey.version, this.encrypt(value, activeKey.value, activeKey.version)],
        );
        result[fieldKey] = null;
      } else {
        await this.executor.query('DELETE FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2 AND field_key = $3', [resourceType, resourceId, fieldKey]);
      }
    }
    return result;
  }

  async restore(resourceType: ResourceType, resourceId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = { ...payload };
    const rows = await this.executor.query<{ field_key: string; key_version: string; ciphertext: string }>('SELECT field_key, key_version, ciphertext FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2', [resourceType, resourceId]);
    for (const row of rows.rows) {
      result[row.field_key] = this.decrypt(row.ciphertext, row.key_version);
    }
    return result;
  }

  async rotateBatch(limit: number): Promise<number> {
    const active = this.keyring.active();
    const rows = await this.executor.query<{ resource_type: ResourceType; resource_id: string; field_key: string; key_version: string; ciphertext: string }>(
      `SELECT resource_type, resource_id, field_key, key_version, ciphertext
       FROM resource_field_ciphertexts
       WHERE key_version <> $1
       ORDER BY updated_at, resource_id, field_key
       LIMIT $2`,
      [active.version, Math.max(1, Math.min(1000, limit))],
    );
    let rotated = 0;
    for (const row of rows.rows) {
      const value = this.decrypt(row.ciphertext, row.key_version);
      const ciphertext = this.encrypt(value, active.value, active.version);
      const result = await this.executor.query(
        `UPDATE resource_field_ciphertexts
         SET key_version = $1, ciphertext = $2, updated_at = NOW()
         WHERE resource_type = $3 AND resource_id = $4 AND field_key = $5 AND key_version = $6`,
        [active.version, ciphertext, row.resource_type, row.resource_id, row.field_key, row.key_version],
      );
      rotated += result.rowCount ?? 0;
    }
    return rotated;
  }

  async redact(resourceType: ResourceType, typeId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const modes = await this.modes(resourceType, typeId);
    const globalEnabled = await this.config.get<boolean>('data.fieldsEncryptionEnabled');
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => {
      const mode = modes.get(key);
      const encrypted = globalEnabled && mode === 'encrypted';
      return [key, encrypted ? '[ENCRYPTED]' : value];
    }));
  }

  private async modes(resourceType: ResourceType, typeId: string): Promise<Map<string, Mode>> {
    const table = resourceType === 'node' ? 'node_type_fields' : 'entity_type_fields';
    const column = resourceType === 'node' ? 'node_type_id' : 'entity_type_id';
    const result = await this.executor.query<{ field_key: string; encryption_mode: Mode }>(`SELECT field_key, encryption_mode FROM ${table} WHERE ${column} = $1 AND data_type NOT IN ('file', 'image')`, [typeId]);
    return new Map(result.rows.map((row) => [row.field_key, row.encryption_mode]));
  }

  private encrypt(value: unknown, key: Buffer, version: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value) ?? 'null', 'utf8'), cipher.final()]);
    return [HEADER, version, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
  }

  private decrypt(value: string, storedVersion: string): unknown {
    const parts = value.split(':');
    const [header, versionOrIv, ivOrTag, tagOrCiphertext, ciphertextMaybe] = parts;
    const version = ciphertextMaybe ? versionOrIv : storedVersion;
    const ivText = ciphertextMaybe ? ivOrTag : versionOrIv;
    const tagText = ciphertextMaybe ? tagOrCiphertext : ivOrTag;
    const ciphertextText = ciphertextMaybe ?? tagOrCiphertext;
    if (header !== HEADER || !version || !ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted field format');
    const decipher = createDecipheriv('aes-256-gcm', this.keyring.get(version), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext) as unknown;
  }
}
