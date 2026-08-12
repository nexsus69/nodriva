import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { ConfigurationRecord, ConfigurationRepository } from '../../application/ports/ConfigurationRepository.js';
import { SqliteDatabase } from './SqliteDatabase.js';

interface SettingRow { setting_key: string; value_type: string; value_text: string | null; value_json: string | null; row_version: number; updated_at: string; }

export class ConfigurationRepositorySqlite implements ConfigurationRepository {
  constructor(private readonly database: SqliteDatabase) {}
  async get(key: string): Promise<ConfigurationRecord | null> { const row = this.database.get<SettingRow>('SELECT * FROM system_settings WHERE setting_key=? AND deleted_at IS NULL', [key]); return row ? this.map(row) : null; }
  async set(key: string, value: unknown, expectedVersion: number): Promise<ConfigurationRecord> {
    const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'decimal') : typeof value === 'string' ? 'string' : 'json';
    const text = type === 'json' ? null : String(value);
    const json = type === 'json' ? JSON.stringify(value) : null;
    const result = this.database.run('UPDATE system_settings SET value_type=?,value_text=?,value_json=?,row_version=row_version+1,updated_at=? WHERE setting_key=? AND row_version=? AND deleted_at IS NULL', [type, text, json, new Date().toISOString(), key, expectedVersion]);
    if (result.changes === 0) { const current = this.database.get<{ row_version: number }>('SELECT row_version FROM system_settings WHERE setting_key=? AND deleted_at IS NULL', [key]); throw new RowVersionMismatchError(expectedVersion, current?.row_version ?? 0); }
    return (await this.get(key))!;
  }
  private map(row: SettingRow): ConfigurationRecord { let value: unknown = row.value_text; if (row.value_type === 'integer') value = Number(row.value_text ?? 0); if (row.value_type === 'decimal') value = Number(row.value_text ?? 0); if (row.value_type === 'boolean') value = row.value_text === 'true'; if (row.value_type === 'json') value = row.value_json ? JSON.parse(row.value_json) : null; return { key: row.setting_key, value, version: row.row_version, updatedAt: new Date(row.updated_at) }; }
}
