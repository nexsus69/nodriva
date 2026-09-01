import type { ServiceConfigurationKey } from '../config/ServiceConfigurationRegistry.js';

export interface ServiceHealthCheckResult {
  serviceKey: ServiceConfigurationKey;
  providerKey: string;
  status: 'healthy' | 'unhealthy' | 'not-configured' | 'disabled';
  checkedAt: Date;
  latencyMs?: number;
  /** Stable, client-safe classification for Admin and observability. */
  code?: 'capability_disabled' | 'provider_not_configured' | 'healthcheck_unavailable' | 'healthcheck_failed' | 'configuration_invalid';
  message?: string;
}

export interface ServiceHealthCheckPort {
  check(
    serviceKey: ServiceConfigurationKey,
    providerKey: string,
    values: Readonly<Record<string, unknown>>,
  ): Promise<ServiceHealthCheckResult>;
}

export interface ServiceHealthCheckRegistry {
  register(serviceKey: ServiceConfigurationKey, providerKey: string, checker: ServiceHealthCheckPort): void;
  get(serviceKey: ServiceConfigurationKey, providerKey: string): ServiceHealthCheckPort | null;
}

export class DefaultServiceHealthCheckRegistry implements ServiceHealthCheckRegistry {
  private readonly checkers = new Map<string, ServiceHealthCheckPort>();

  register(serviceKey: ServiceConfigurationKey, providerKey: string, checker: ServiceHealthCheckPort): void {
    const key = `${serviceKey}:${providerKey}`;
    if (this.checkers.has(key)) throw new Error(`Healthcheck '${key}' is already registered.`);
    this.checkers.set(key, checker);
  }

  get(serviceKey: ServiceConfigurationKey, providerKey: string): ServiceHealthCheckPort | null {
    return this.checkers.get(`${serviceKey}:${providerKey}`) ?? null;
  }
}
