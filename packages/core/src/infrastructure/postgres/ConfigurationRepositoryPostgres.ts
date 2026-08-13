import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type {
  ConfigurationRecord,
  ConfigurationRepository,
} from '../../application/ports/ConfigurationRepository.js';
import type { PgExecutor } from './PgExecutor.js';

interface SettingRow {
  setting_key: string;
  value_type: string;
  value_text: string | null;
  value_json: unknown | null;
  row_version: number;
  updated_at: Date;
}

export class ConfigurationRepositoryPostgres implements ConfigurationRepository {
  constructor(private readonly executor: PgExecutor) {}

  async get(key: string): Promise<ConfigurationRecord | null> {
    const result = await this.executor.query<SettingRow>(
      `SELECT setting_key, value_type, value_text, value_json, row_version, updated_at
       FROM system_settings
       WHERE setting_key = $1 AND deleted_at IS NULL`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.toRecord(row);
  }

  async set(key: string, value: unknown, expectedVersion: number): Promise<ConfigurationRecord> {
    const valueText = typeof value === 'boolean' ? String(value) : String(value);
    const result = await this.executor.query<SettingRow>(
      `UPDATE system_settings
       SET value_text = $1, row_version = row_version + 1, updated_at = NOW()
       WHERE setting_key = $2 AND row_version = $3 AND deleted_at IS NULL
       RETURNING setting_key, value_type, value_text, value_json, row_version, updated_at`,
      [valueText, key, expectedVersion],
    );
    const row = result.rows[0];
    if (!row) {
      const current = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM system_settings WHERE setting_key = $1 AND deleted_at IS NULL',
        [key],
      );
      throw new RowVersionMismatchError(expectedVersion, current.rows[0]?.row_version ?? 0);
    }
    return this.toRecord(row);
  }

  private toRecord(row: SettingRow): ConfigurationRecord {
    let value: unknown = row.value_text;
    if (row.value_type === 'integer') value = row.value_text === null ? 0 : Number.parseInt(row.value_text, 10);
    if (row.value_type === 'decimal') value = row.value_text === null ? 0 : Number.parseFloat(row.value_text);
    if (row.value_type === 'boolean') value = row.value_text === 'true';
    if (row.value_type === 'json') value = row.value_json;
    return {
      key: row.setting_key,
      value,
      version: Number(row.row_version),
      updatedAt: new Date(row.updated_at),
    };
  }
}
