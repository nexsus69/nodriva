import { describe, expect, it, vi } from 'vitest';
import { PostgresHealthCheck } from './ServiceHealthCheckAdapters';
import type { PgExecutor } from '@dashboard/core';

describe('service health check adapters', () => {
  it('reports PostgreSQL health from the query result', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) } as unknown as PgExecutor;
    const health = await new PostgresHealthCheck(executor).check('database', 'postgres', {});

    expect(health.status).toBe('healthy');
    expect(executor.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports PostgreSQL failures without throwing', async () => {
    const executor = { query: vi.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as PgExecutor;
    await expect(new PostgresHealthCheck(executor).check('database', 'postgres', {})).resolves.toMatchObject({
      status: 'unhealthy', message: 'database unavailable',
    });
  });
});
