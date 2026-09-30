/** Implements FieldEncryptionServiceSqlite within its adapter or regression boundary. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ConfigService } from '../../application/services/ConfigService.js';
import { EncryptionKeyring } from '../crypto/EncryptionKeyring.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

type ResourceType = 'node' | 'entity';

interface EncryptionModeRow {
  field_key: string;
  encryption_mode: 'plaintext' | 'encrypted';
}

interface CiphertextRow {
  resource_type: ResourceType;
  resource_id: string;
  field_key: string;
  key_version: string;
  ciphertext: string;
}

interface FieldKeyRow {
  field_key: string;
}

export class FieldEncryptionServiceSqlite {
  private readonly keyring: EncryptionKeyring;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly config: ConfigService,
    keyHex?: string,
    keyringSpec?: string,
    activeVersion = 'v1',
  ) { this.database.protectAsyncMethods(this);
    this.keyring = new EncryptionKeyring(keyHex, keyringSpec, activeVersion, 'FIELD_ENCRYPTION_KEY');
  }

  async protect(
    resourceType: ResourceType,
    typeId: string,
    resourceId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { fieldsTable, typeColumn } = this.fieldMetadata(resourceType);
    const fields = this.database.all<EncryptionModeRow>(
      `SELECT field_key,encryption_mode FROM ${fieldsTable} WHERE ${typeColumn}=? AND data_type NOT IN('file','image')`,
      [typeId],
    );
    const enabled = await this.config.get<boolean>('data.fieldsEncryptionEnabled');
    const result = { ...payload };

    for (const field of fields) {
      if (!Object.hasOwn(payload, field.field_key)) {
        this.deleteCiphertext(resourceType, resourceId, field.field_key);
        continue;
      }
      const value = payload[field.field_key];
      if (enabled && field.encryption_mode === 'encrypted' && value !== null && value !== '') {
        const key = this.keyring.active();
        this.database.run(
          `INSERT INTO resource_field_ciphertexts(resource_type,resource_id,field_key,key_version,ciphertext)
           VALUES(?,?,?,?,?)
           ON CONFLICT(resource_type,resource_id,field_key)
           DO UPDATE SET key_version=excluded.key_version,ciphertext=excluded.ciphertext`,
          [resourceType, resourceId, field.field_key, key.version, this.encrypt(value, key.value, key.version)],
        );
        result[field.field_key] = null;
      } else {
        this.deleteCiphertext(resourceType, resourceId, field.field_key);
      }
    }
    return result;
  }

  async restore(
    resourceType: ResourceType,
    resourceId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = { ...payload };
    const rows = this.database.all<CiphertextRow>(
      'SELECT resource_type,resource_id,field_key,key_version,ciphertext FROM resource_field_ciphertexts WHERE resource_type=? AND resource_id=?',
      [resourceType, resourceId],
    );
    for (const row of rows) result[row.field_key] = this.decrypt(row.ciphertext, row.key_version);
    return result;
  }

  async rotateBatch(limit: number): Promise<number> {
    const active = this.keyring.active();
    const rows = this.database.all<CiphertextRow>(
      `SELECT resource_type,resource_id,field_key,key_version,ciphertext
       FROM resource_field_ciphertexts WHERE key_version<>? ORDER BY resource_id,field_key LIMIT ?`,
      [active.version, Math.max(1, Math.min(1000, limit))],
    );
    for (const row of rows) {
      this.database.run(
        `UPDATE resource_field_ciphertexts SET key_version=?,ciphertext=?
         WHERE resource_type=? AND resource_id=? AND field_key=? AND key_version=?`,
        [
          active.version,
          this.encrypt(this.decrypt(row.ciphertext, row.key_version), active.value, active.version),
          row.resource_type,
          row.resource_id,
          row.field_key,
          row.key_version,
        ],
      );
    }
    return rows.length;
  }

  async redact(
    resourceType: ResourceType,
    typeId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { fieldsTable, typeColumn } = this.fieldMetadata(resourceType);
    const enabled = await this.config.get<boolean>('data.fieldsEncryptionEnabled');
    const encrypted = new Set(this.database.all<FieldKeyRow>(
      `SELECT field_key FROM ${fieldsTable} WHERE ${typeColumn}=? AND encryption_mode='encrypted'`,
      [typeId],
    ).map((row) => row.field_key));
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [
      key,
      enabled && encrypted.has(key) ? '[ENCRYPTED]' : value,
    ]));
  }

  private fieldMetadata(resourceType: ResourceType): { fieldsTable: string; typeColumn: string } {
    return resourceType === 'node'
      ? { fieldsTable: 'node_type_fields', typeColumn: 'node_type_id' }
      : { fieldsTable: 'entity_type_fields', typeColumn: 'entity_type_id' };
  }

  private deleteCiphertext(resourceType: ResourceType, resourceId: string, fieldKey: string): void {
    this.database.run(
      'DELETE FROM resource_field_ciphertexts WHERE resource_type=? AND resource_id=? AND field_key=?',
      [resourceType, resourceId, fieldKey],
    );
  }

  private encrypt(value: unknown, key: Buffer, version: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const text = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return ['DASHFIELD1', version, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), text.toString('base64url')].join(':');
  }

  private decrypt(value: string, storedVersion: string): unknown {
    const [header, version, iv, tag, text] = value.split(':');
    if (header !== 'DASHFIELD1' || !version || !iv || !tag || !text || version !== storedVersion) {
      throw new Error('Invalid encrypted field format or key version.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.keyring.get(version), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(text, 'base64url')), decipher.final()]).toString('utf8')) as unknown;
  }
}
