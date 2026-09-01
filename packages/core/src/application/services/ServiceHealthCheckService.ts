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
        return { serviceKey, providerKey: '', status: 'not-configured', checkedAt: this.now() };
      }
      throw error;
    }
    const checker = this.checks.get(serviceKey, config.providerKey);
    if (config.availability === 'disabled' || config.providerKey === 'disabled' || config.values.enabled === false) {
      return {
        serviceKey,
        providerKey: config.providerKey,
        status: 'disabled',
        checkedAt: this.now(),
      };
    }
    if (!checker) {
      return {
        serviceKey,
        providerKey: config.providerKey,
        status: 'not-configured',
        checkedAt: this.now(),
        message: 'No healthcheck adapter is registered for this provider.',
      };
    }
    return checker.check(serviceKey, config.providerKey, config.values);
  }
}
