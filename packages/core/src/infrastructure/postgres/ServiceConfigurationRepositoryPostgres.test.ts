import { describe, expect, it, vi } from 'vitest';
import type { PgExecutor } from './PgExecutor.js';
import { ServiceConfigurationRepositoryPostgres } from './ServiceConfigurationRepositoryPostgres.js';

describe('ServiceConfigurationRepositoryPostgres', () => {
  it('reads a versioned runtime configuration record', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{
      service_key: 'realtime', provider_key: 'soketi', runtime_values: { enabled: true }, row_version: 3, updated_at: new Date(),
    }] }) } as unknown as PgExecutor;
    const repository = new ServiceConfigurationRepositoryPostgres(executor);

    await expect(repository.get('realtime')).resolves.toMatchObject({
      serviceKey: 'realtime', providerKey: 'soketi', values: { enabled: true }, version: 3,
    });
  });

  it('persists runtime values with optimistic concurrency', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{
      service_key: 'realtime', provider_key: 'soketi', runtime_values: { enabled: false }, row_version: 4, updated_at: new Date(),
    }] }) } as unknown as PgExecutor;
    const repository = new ServiceConfigurationRepositoryPostgres(executor);

    await expect(repository.setRuntimeValues('realtime', 'soketi', { enabled: false }, 3))
      .resolves.toMatchObject({ version: 4, values: { enabled: false } });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (service_key)'), [
      'realtime', 'soketi', '{"enabled":false}', 3,
    ]);
  });

  it('reports a row-version conflict when the update affects no row', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ row_version: 5 }] }) } as unknown as PgExecutor;
    const repository = new ServiceConfigurationRepositoryPostgres(executor);

    await expect(repository.setRuntimeValues('realtime', 'soketi', { enabled: false }, 3))
      .rejects.toMatchObject({ code: 'ROW_VERSION_MISMATCH', details: { expected: 3, actual: 5 } });
  });
});
