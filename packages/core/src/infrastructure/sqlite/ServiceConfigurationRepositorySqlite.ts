import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { ServiceConfigurationKey } from '../../application/config/ServiceConfigurationRegistry.js';
import type {
  ServiceConfigurationRepository,
  ServiceRuntimeConfigurationRecord,
} from '../../application/ports/ServiceConfigurationRepository.js';
import { SqliteDatabase } from './SqliteDatabase.js';

type ServiceRow = { serviceKey: ServiceConfigurationKey; providerKey: string; runtimeValues: string; version: number; updatedAt: string };

export class ServiceConfigurationRepositorySqlite implements ServiceConfigurationRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async get(serviceKey: ServiceConfigurationKey): Promise<ServiceRuntimeConfigurationRecord | null> {
    const row = this.database.get<ServiceRow>(
      `SELECT service_key AS serviceKey, provider_key AS providerKey, runtime_values AS runtimeValues,
              row_version AS version, updated_at AS updatedAt
         FROM service_configurations WHERE service_key = ?`, [serviceKey],
    );
    return row ? this.toRecord(row) : null;
  }

  async setRuntimeValues(serviceKey: ServiceConfigurationKey, providerKey: string, values: Readonly<Record<string, unknown>>, expectedVersion: number): Promise<ServiceRuntimeConfigurationRecord> {
    if (expectedVersion === 1) {
      this.database.run(
        `INSERT INTO service_configurations(service_key, provider_key, runtime_values, row_version)
         VALUES (?, ?, ?, 1) ON CONFLICT(service_key) DO NOTHING`,
        [serviceKey, providerKey, JSON.stringify(values)],
      );
    }
    const next = expectedVersion + 1;
    const result = this.database.run(
      `UPDATE service_configurations
          SET provider_key = ?, runtime_values = ?, row_version = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE service_key = ? AND row_version = ?`,
      [providerKey, JSON.stringify(values), next, serviceKey, expectedVersion],
    );
    if (result.changes === 0) {
      const current = this.database.get<{ version: number }>('SELECT row_version AS version FROM service_configurations WHERE service_key = ?', [serviceKey]);
      throw new RowVersionMismatchError(expectedVersion, Number(current?.version ?? 0));
    }
    const row = await this.get(serviceKey);
    if (!row) throw new Error(`Service configuration ${serviceKey} was not persisted`);
    return row;
  }

  private toRecord(row: ServiceRow): ServiceRuntimeConfigurationRecord {
    const parsed: unknown = JSON.parse(row.runtimeValues);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Stored runtime configuration for '${row.serviceKey}' must be a JSON object.`);
    }
    const values = parsed as Record<string, unknown>;
    return { serviceKey: row.serviceKey, providerKey: row.providerKey, values, version: Number(row.version), updatedAt: new Date(row.updatedAt) };
  }
}
