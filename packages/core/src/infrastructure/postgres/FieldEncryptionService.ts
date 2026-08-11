import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ConfigService } from '../../application/services/ConfigService.js';
import type { PgExecutor } from './PgExecutor.js';

type ResourceType = 'node' | 'entity';
type Mode = 'plaintext' | 'encrypted';
const HEADER = 'DASHFIELD1';

export class FieldEncryptionService {
  private readonly key?: Buffer;

  constructor(private readonly executor: PgExecutor, private readonly config: ConfigService, keyHex = process.env.FIELD_ENCRYPTION_KEY ?? process.env.ATTACHMENTS_ENCRYPTION_KEY) {
    if (keyHex) {
      if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('FIELD_ENCRYPTION_KEY must be a 32-byte hex key');
      this.key = Buffer.from(keyHex, 'hex');
    }
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
        if (!this.key) throw new Error('Field encryption requested but FIELD_ENCRYPTION_KEY is missing');
        await this.executor.query(
          `INSERT INTO resource_field_ciphertexts (resource_type, resource_id, field_key, key_version, ciphertext)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (resource_type, resource_id, field_key) DO UPDATE SET key_version = EXCLUDED.key_version, ciphertext = EXCLUDED.ciphertext, updated_at = NOW()`,
          [resourceType, resourceId, fieldKey, 'v1', this.encrypt(value)],
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
    const rows = await this.executor.query<{ field_key: string; ciphertext: string }>('SELECT field_key, ciphertext FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2', [resourceType, resourceId]);
    for (const row of rows.rows) {
      if (!this.key) throw new Error('Encrypted field cannot be decrypted because FIELD_ENCRYPTION_KEY is missing');
      result[row.field_key] = this.decrypt(row.ciphertext);
    }
    return result;
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

  private encrypt(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key!, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value) ?? 'null', 'utf8'), cipher.final()]);
    return [HEADER, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
  }

  private decrypt(value: string): unknown {
    const [header, ivText, tagText, ciphertextText] = value.split(':');
    if (header !== HEADER || !ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted field format');
    const decipher = createDecipheriv('aes-256-gcm', this.key!, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext) as unknown;
  }
}
