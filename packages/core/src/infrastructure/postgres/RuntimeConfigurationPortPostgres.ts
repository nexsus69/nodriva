import { RuntimeConfigurationPort } from '../../application/ports/RuntimeConfigurationPort.js';
import { PgExecutor } from './PgExecutor.js';

interface SettingRow {
  value_type: string;
  value_text: string | null;
  value_json: unknown | null;
}

/**
 * Adapter PostgreSQL per la gestione delle configurazioni runtime e delle capabilities.
 * Legge impostazioni e profili dalle tabelle `system_settings` e `runtime_capabilities`.
 */
export class RuntimeConfigurationPortPostgres implements RuntimeConfigurationPort {
  constructor(private readonly executor: PgExecutor) {}

  async isCapabilityEnabled(capabilityKey: string): Promise<boolean> {
    // Risolve lo stato della capability considerando il profilo attivo e gli override.
    // Profilo attivo letto da active_profile (default single-user).
    const query = `
      SELECT COALESCE(
        (
          SELECT o.status::text
          FROM runtime_capability_overrides o
          JOIN runtime_capabilities c ON o.capability_id = c.id
          WHERE c.capability_key = $1 AND o.scope_key = COALESCE(
            (SELECT value_text FROM system_settings WHERE setting_key = 'active_profile' LIMIT 1),
            'single-user'
          )
        ),
        (
          SELECT default_status::text FROM runtime_capabilities WHERE capability_key = $1
        )
      ) AS status
    `;

    const result = await this.executor.query<{ status: string }>(query, [capabilityKey]);
    const row = result.rows[0];

    // Ritorna true solo se lo stato risultante è 'enabled'
    return row?.status === 'enabled';
  }

  async getSetting<T>(settingKey: string, defaultValue: T): Promise<T> {
    const query = `
      SELECT value_type, value_text, value_json
      FROM system_settings
      WHERE setting_key = $1 AND deleted_at IS NULL
    `;

    const result = await this.executor.query<SettingRow>(query, [settingKey]);
    const row = result.rows[0];

    if (!row) {
      return defaultValue;
    }

    const valType = row.value_type.toLowerCase();

    if (valType === 'string') {
      return (row.value_text ?? '') as unknown as T;
    }
    if (valType === 'integer') {
      return (row.value_text ? parseInt(row.value_text, 10) : 0) as unknown as T;
    }
    if (valType === 'decimal') {
      return (row.value_text ? parseFloat(row.value_text) : 0.0) as unknown as T;
    }
    if (valType === 'boolean') {
      return (row.value_text === 'true') as unknown as T;
    }
    if (valType === 'json') {
      // In pg, la colonna JSONB viene restituita già deserializzata dal driver
      return (row.value_json ?? defaultValue) as T;
    }

    return defaultValue;
  }
}
