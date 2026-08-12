import type { RuntimeConfigurationPort } from '../../application/ports/RuntimeConfigurationPort.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class RuntimeConfigurationPortSqlite implements RuntimeConfigurationPort {
  constructor(private readonly database: SqliteDatabase, private readonly scopeKey = 'single-user') {}
  async isCapabilityEnabled(capabilityKey: string): Promise<boolean> { const row = this.database.get<{ status: string }>('SELECT COALESCE((SELECT status FROM runtime_capability_overrides WHERE capability_key=? AND scope_key=?),(SELECT default_status FROM runtime_capabilities WHERE capability_key=?)) AS status', [capabilityKey, this.scopeKey, capabilityKey]); return row?.status === 'enabled'; }
  async getSetting<T>(settingKey: string, defaultValue: T): Promise<T> { const row = this.database.get<{ value_type: string; value_text: string | null; value_json: string | null }>('SELECT value_type,value_text,value_json FROM system_settings WHERE setting_key=? AND deleted_at IS NULL', [settingKey]); if (!row) return defaultValue; if (row.value_type === 'boolean') return (row.value_text === 'true') as T; if (row.value_type === 'integer' || row.value_type === 'decimal') return Number(row.value_text ?? 0) as T; if (row.value_type === 'json') return (row.value_json ? JSON.parse(row.value_json) : defaultValue) as T; return (row.value_text ?? '') as T; }
}
