import net from 'node:net';
import type { PgExecutor, ServiceHealthCheckPort, ServiceHealthCheckResult, SqliteDatabase } from '@dashboard/core';

function elapsed(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function result(
  serviceKey: ServiceHealthCheckResult['serviceKey'],
  providerKey: string,
  startedAt: number,
  status: ServiceHealthCheckResult['status'],
  message?: string,
): ServiceHealthCheckResult {
  return {
    serviceKey,
    providerKey,
    status,
    checkedAt: new Date(),
    latencyMs: elapsed(startedAt),
    ...(message ? { message } : {}),
  };
}

export class PostgresHealthCheck implements ServiceHealthCheckPort {
  constructor(private readonly executor: PgExecutor) {}

  async check(serviceKey: ServiceHealthCheckResult['serviceKey'], providerKey: string, values: Readonly<Record<string, unknown>>): Promise<ServiceHealthCheckResult> {
    void values;
    const startedAt = Date.now();
    try {
      await this.executor.query('SELECT 1');
      return result(serviceKey, providerKey, startedAt, 'healthy');
    } catch (error) {
      return result(serviceKey, providerKey, startedAt, 'unhealthy', error instanceof Error ? error.message : 'Database healthcheck failed.');
    }
  }
}

export class SqliteHealthCheck implements ServiceHealthCheckPort {
  constructor(private readonly database: SqliteDatabase) {}

  async check(serviceKey: ServiceHealthCheckResult['serviceKey'], providerKey: string, values: Readonly<Record<string, unknown>>): Promise<ServiceHealthCheckResult> {
    void values;
    const startedAt = Date.now();
    try {
      this.database.get('SELECT 1');
      return result(serviceKey, providerKey, startedAt, 'healthy');
    } catch (error) {
      return result(serviceKey, providerKey, startedAt, 'unhealthy', error instanceof Error ? error.message : 'SQLite healthcheck failed.');
    }
  }
}

export class RealtimeHttpHealthCheck implements ServiceHealthCheckPort {
  constructor(private readonly timeoutMs = 3_000) {}

  async check(serviceKey: ServiceHealthCheckResult['serviceKey'], providerKey: string, values: Readonly<Record<string, unknown>>): Promise<ServiceHealthCheckResult> {
    const startedAt = Date.now();
    const host = typeof values.internalHost === 'string' ? values.internalHost : null;
    const port = typeof values.internalPort === 'number' ? values.internalPort : null;
    if (!host || !port) return result(serviceKey, providerKey, startedAt, 'unhealthy', 'Realtime internal endpoint is incomplete.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`http://${host}:${port}/ready`, { signal: controller.signal, cache: 'no-store' });
      return response.ok
        ? result(serviceKey, providerKey, startedAt, 'healthy')
        : result(serviceKey, providerKey, startedAt, 'unhealthy', `Realtime readiness returned HTTP ${response.status}.`);
    } catch (error) {
      return result(serviceKey, providerKey, startedAt, 'unhealthy', error instanceof Error ? error.message : 'Realtime healthcheck failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ClamAvHealthCheck implements ServiceHealthCheckPort {
  constructor(private readonly timeoutMs = 3_000) {}

  async check(serviceKey: ServiceHealthCheckResult['serviceKey'], providerKey: string, values: Readonly<Record<string, unknown>>): Promise<ServiceHealthCheckResult> {
    const startedAt = Date.now();
    const host = typeof values.host === 'string' ? values.host : null;
    const port = typeof values.port === 'number' ? values.port : null;
    if (!host || !port) return result(serviceKey, providerKey, startedAt, 'unhealthy', 'Antivirus endpoint is incomplete.');

    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      let settled = false;
      const finish = (status: ServiceHealthCheckResult['status'], message?: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result(serviceKey, providerKey, startedAt, status, message));
      };
      const timeout = setTimeout(() => finish('unhealthy', 'Antivirus healthcheck timed out.'), this.timeoutMs);
      socket.setEncoding('utf8');
      socket.on('connect', () => socket.write('PING\n'));
      socket.on('data', (data: string) => {
        clearTimeout(timeout);
        finish(data.includes('PONG') ? 'healthy' : 'unhealthy', data.includes('PONG') ? undefined : 'Antivirus did not return PONG.');
      });
      socket.on('error', (error) => {
        clearTimeout(timeout);
        finish('unhealthy', error.message);
      });
      socket.on('close', () => clearTimeout(timeout));
    });
  }
}
