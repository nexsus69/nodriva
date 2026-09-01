/** Executes provider probes and returns stable, sanitized operational health results. */
import type { ServiceConfigurationKey } from '../config/ServiceConfigurationRegistry.js';
import type { ServiceConfigurationService } from './ServiceConfigurationService.js';
import { ServiceConfigurationValidationError } from './ServiceConfigurationService.js';
import type { ServiceHealthCheckRegistry, ServiceHealthCheckResult } from '../ports/ServiceHealthCheckPort.js';

export class ServiceHealthCheckService {
  constructor(
    private readonly configuration: ServiceConfigurationService,
    private readonly checks: ServiceHealthCheckRegistry,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async check(serviceKey: ServiceConfigurationKey): Promise<ServiceHealthCheckResult> {
    let config;
    try {
      config = await this.configuration.get(serviceKey);
    } catch (error) {
      if (error instanceof ServiceConfigurationValidationError && error.message.includes('no provider configured')) {
        return { serviceKey, providerKey: '', status: 'not-configured', code: 'provider_not_configured', checkedAt: this.now() };
      }
      if (error instanceof ServiceConfigurationValidationError) {
        return { serviceKey, providerKey: '', status: 'unhealthy', code: 'configuration_invalid', checkedAt: this.now(), message: 'Service configuration is invalid.' };
      }
      throw error;
    }
    const checker = this.checks.get(serviceKey, config.providerKey);
    if (config.availability === 'disabled' || config.providerKey === 'disabled' || config.values.enabled === false) {
      return {
        serviceKey,
        providerKey: config.providerKey,
        status: 'disabled',
        code: 'capability_disabled',
        checkedAt: this.now(),
      };
    }
    if (!checker) {
      return {
        serviceKey,
        providerKey: config.providerKey,
        status: 'not-configured',
        code: 'healthcheck_unavailable',
        checkedAt: this.now(),
        message: 'No healthcheck adapter is registered for this provider.',
      };
    }
    try {
      const result = await checker.check(serviceKey, config.providerKey, config.values);
      return result.status === 'unhealthy'
        ? { ...result, code: 'healthcheck_failed', message: 'Healthcheck failed.' }
        : result;
    } catch {
      return {
        serviceKey,
        providerKey: config.providerKey,
        status: 'unhealthy',
        code: 'healthcheck_failed',
        checkedAt: this.now(),
        message: 'Healthcheck failed.',
      };
    }
  }
}
