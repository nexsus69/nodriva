import type { ServiceConfigurationKey } from '../config/ServiceConfigurationRegistry.js';

export interface ServiceRuntimeConfigurationRecord {
  serviceKey: ServiceConfigurationKey;
  providerKey: string;
  values: Readonly<Record<string, unknown>>;
  version: number;
  updatedAt?: Date;
}

export interface ServiceConfigurationRepository {
  get(serviceKey: ServiceConfigurationKey): Promise<ServiceRuntimeConfigurationRecord | null>;
  setRuntimeValues(
    serviceKey: ServiceConfigurationKey,
    providerKey: string,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<ServiceRuntimeConfigurationRecord>;
}

export interface ServiceDeploymentConfigurationSource {
  get(serviceKey: ServiceConfigurationKey): Promise<{
    providerKey: string;
    values: Readonly<Record<string, unknown>>;
  } | null>;
}

export interface SecretReferenceResolver {
  resolve(reference: string): Promise<string | null>;
}
