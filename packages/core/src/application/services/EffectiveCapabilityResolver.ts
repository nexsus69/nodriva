import type { ServiceConfigurationKey } from '../config/ServiceConfigurationRegistry.js';
import type { ServiceConfigurationService } from './ServiceConfigurationService.js';

export type EffectiveCapabilityStatus = 'enabled' | 'disabled' | 'not-configured';

export interface EffectiveCapability {
  capabilityKey: string;
  serviceKey: ServiceConfigurationKey;
  providerKey: string;
  status: EffectiveCapabilityStatus;
  reason: 'provider-configured' | 'provider-disabled' | 'deployment-missing' | 'runtime-disabled';
}

/**
 * Composes deployment configuration and runtime policy into one capability
 * state. Consumers must use this result instead of independently inspecting
 * environment values and legacy runtime capability rows.
 */
export class EffectiveCapabilityResolver {
  constructor(private readonly configuration: ServiceConfigurationService) {}

  async resolve(serviceKey: ServiceConfigurationKey): Promise<EffectiveCapability> {
    const configuration = await this.configuration.get(serviceKey);
    const capabilityKey = this.configurationCapabilityKey(serviceKey);
    if (configuration.values.enabled === false) {
      return { capabilityKey, serviceKey, providerKey: configuration.providerKey, status: 'disabled', reason: 'runtime-disabled' };
    }
    if (configuration.providerKey === 'disabled' || configuration.availability === 'disabled') {
      return { capabilityKey, serviceKey, providerKey: configuration.providerKey, status: 'disabled', reason: configuration.providerKey === 'disabled' ? 'provider-disabled' : 'deployment-missing' };
    }
    return { capabilityKey, serviceKey, providerKey: configuration.providerKey, status: 'enabled', reason: 'provider-configured' };
  }

  async isEnabled(serviceKey: ServiceConfigurationKey): Promise<boolean> {
    return (await this.resolve(serviceKey)).status === 'enabled';
  }

  private configurationCapabilityKey(serviceKey: ServiceConfigurationKey): string {
    return this.configuration.registryDefinition(serviceKey).capabilityKey ?? serviceKey;
  }
}
