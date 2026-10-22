/** Verifies that the readiness endpoint returns 200 when database is healthy and 503 when unhealthy. */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../server/db', () => ({
  serviceHealthCheckService: {
    check: vi.fn(),
  },
}));

import { serviceHealthCheckService } from '../../../server/db';
import { GET as readyGet } from './route';
import { GET as healthGet } from '../health/route';

describe('Operational Probes', () => {
  it('returns 200 ready when database healthcheck reports healthy', async () => {
    vi.mocked(serviceHealthCheckService.check).mockResolvedValue({
      serviceKey: 'database',
      providerKey: 'sqlite',
      status: 'healthy',
      checkedAt: new Date(),
      latencyMs: 2,
    });

    const response = await readyGet();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ready',
      database: { status: 'healthy', provider: 'sqlite', latencyMs: 2 },
    });
  });

  it('returns 503 unhealthy when database healthcheck reports unhealthy', async () => {
    vi.mocked(serviceHealthCheckService.check).mockResolvedValue({
      serviceKey: 'database',
      providerKey: 'postgres',
      status: 'unhealthy',
      checkedAt: new Date(),
      latencyMs: 15,
      message: 'Connection pool exhausted',
    });

    const response = await readyGet();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'unhealthy',
      database: { status: 'unhealthy', provider: 'postgres', message: 'Connection pool exhausted' },
    });
  });

  it('returns 200 healthy for the liveness health probe', async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.uptimeSeconds).toBe('number');
  });
});
