import type { ServiceConfigurationKey } from '../config/ServiceConfigurationRegistry.js';

export interface ServiceHealthCheckResult {
  serviceKey: ServiceConfigurationKey;
  providerKey: string;
  status: 'healthy' | 'unhealthy' | 'not-configured' | 'disabled';
  checkedAt: Date;
  latencyMs?: number;
  message?: string;
}

export interface ServiceHealthCheckPort {
  check(
    serviceKey: ServiceConfigurationKey,
    providerKey: string,
    values: Readonly<Record<string, unknown>>,
  ): Promise<ServiceHealthCheckResult>;
}
