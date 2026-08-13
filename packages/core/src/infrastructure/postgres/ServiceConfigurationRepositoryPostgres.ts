import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type {
  ServiceConfigurationKey,
} from '../../application/config/ServiceConfigurationRegistry.js';
import type {
  ServiceConfigurationRepository,
  ServiceRuntimeConfigurationRecord,
} from '../../application/ports/ServiceConfigurationRepository.js';
import type { PgExecutor } from './PgExecutor.js';

interface ServiceConfigurationRow {
  service_key: ServiceConfigurationKey;
  provider_key: string;
  runtime_values: Record<string, unknown>;
  row_version: number;
  updated_at: Date;
}

export class ServiceConfigurationRepositoryPostgres implements ServiceConfigurationRepository {
  constructor(private readonly executor: PgExecutor) {}

  async get(serviceKey: ServiceConfigurationKey): Promise<ServiceRuntimeConfigurationRecord | null> {
    const result = await this.executor.query<ServiceConfigurationRow>(
      `SELECT service_key, provider_key, runtime_values, row_version, updated_at
       FROM service_configurations
       WHERE service_key = $1`,
      [serviceKey],
    );
    const row = result.rows[0];
    return row ? this.toRecord(row) : null;
  }

  async setRuntimeValues(
    serviceKey: ServiceConfigurationKey,
    providerKey: string,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<ServiceRuntimeConfigurationRecord> {
    const result = await this.executor.query<ServiceConfigurationRow>(
      `INSERT INTO service_configurations (service_key, provider_key, runtime_values, row_version)
       SELECT $1, $2, $3::jsonb, 1
       WHERE $4 = 1
       ON CONFLICT (service_key) DO UPDATE
       SET provider_key = EXCLUDED.provider_key,
           runtime_values = EXCLUDED.runtime_values,
           row_version = service_configurations.row_version + 1,
           updated_at = NOW()
       WHERE service_configurations.row_version = $4
       RETURNING service_key, provider_key, runtime_values, row_version, updated_at`,
      [serviceKey, providerKey, JSON.stringify(values), expectedVersion],
    );
    const row = result.rows[0];
    if (!row) {
      const current = await this.executor.query<{ row_version: number }>(
        'SELECT row_version FROM service_configurations WHERE service_key = $1',
        [serviceKey],
      );
      throw new RowVersionMismatchError(expectedVersion, current.rows[0]?.row_version ?? 0);
    }
    return this.toRecord(row);
  }

  private toRecord(row: ServiceConfigurationRow): ServiceRuntimeConfigurationRecord {
    return {
      serviceKey: row.service_key,
      providerKey: row.provider_key,
      values: row.runtime_values ?? {},
      version: Number(row.row_version),
      updatedAt: new Date(row.updated_at),
    };
  }
}
