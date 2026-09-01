import type {
  ServiceConfigurationRegistry} from '../config/ServiceConfigurationRegistry.js';
import {
  type ServiceConfigurationDefinition,
  type ServiceConfigurationFieldDefinition,
  type ServiceConfigurationKey,
} from '../config/ServiceConfigurationRegistry.js';
import type {
  SecretReferenceResolver,
  ServiceConfigurationRepository,
  ServiceDeploymentConfigurationSource,
  ServiceRuntimeConfigurationRecord,
} from '../ports/ServiceConfigurationRepository.js';

export interface EffectiveServiceConfiguration {
  serviceKey: ServiceConfigurationKey;
  providerKey: string;
  values: Readonly<Record<string, unknown>>;
  version: number;
  requirement: 'required' | 'optional';
  availability: 'configured' | 'disabled' | 'not-configured';
  updatedAt?: Date;
}

export interface PublicServiceConfiguration {
  serviceKey: ServiceConfigurationKey;
  providerKey: string;
  values: Readonly<Record<string, unknown>>;
  version: number;
  restartRequired: boolean;
  requirement: 'required' | 'optional';
  availability: 'configured' | 'disabled' | 'not-configured';
  reload: 'hot' | 'process-restart' | 'rebuild' | 'redeploy';
  fallback: 'none' | 'disabled' | 'best-effort' | 'fail-closed';
  dependencies: readonly ServiceConfigurationKey[];
}

export class ServiceConfigurationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceConfigurationValidationError';
  }
}

/** Resolves deployment, runtime and secret sources into a server-side config. */
export class ServiceConfigurationService {
  constructor(
    private readonly registry: ServiceConfigurationRegistry,
    private readonly repository: ServiceConfigurationRepository,
    private readonly deployment: ServiceDeploymentConfigurationSource,
    private readonly secrets?: SecretReferenceResolver,
  ) {}

  async get(serviceKey: ServiceConfigurationKey): Promise<EffectiveServiceConfiguration> {
    return this.resolve(serviceKey, true);
  }

  /** Lists only the sanitized descriptors suitable for an authorized Admin read model. */
  async listPublic(): Promise<readonly PublicServiceConfiguration[]> {
    return Promise.all(this.registry.list().map((definition) => this.getPublic(definition.key)));
  }

  async setRuntimeValues(
    serviceKey: ServiceConfigurationKey,
    providerKey: string,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<ServiceRuntimeConfigurationRecord> {
    const definition = this.registry.get(serviceKey);
    const provider = this.provider(definition, providerKey);
    const deployment = await this.deployment.get(serviceKey);
    if (!deployment && definition.requirement === 'optional') {
      throw new ServiceConfigurationValidationError(`Service '${serviceKey}' is not configured by deployment.`);
    }
    if (deployment && deployment.providerKey !== providerKey) {
      throw new ServiceConfigurationValidationError(`Provider '${providerKey}' is deployment-managed for service '${serviceKey}'.`);
    }
    const allowedRuntimeFields = provider.fields.filter((field) => field.source === 'runtime');
    const allowedKeys = new Set(allowedRuntimeFields.map((field) => field.key));
    for (const key of Object.keys(values)) {
      if (!allowedKeys.has(key)) {
        throw new ServiceConfigurationValidationError(`Configuration '${serviceKey}.${key}' is not runtime-editable.`);
      }
    }
    this.validateValues(allowedRuntimeFields, values, serviceKey);
    return this.repository.setRuntimeValues(serviceKey, providerKey, values, expectedVersion);
  }

  private async resolve(serviceKey: ServiceConfigurationKey, resolveSecrets: boolean): Promise<EffectiveServiceConfiguration> {
    const definition = this.registry.get(serviceKey);
    const deploymentRecord = await this.deployment.get(serviceKey);
    const runtimeRecord = await this.repository.get(serviceKey);
    if (!deploymentRecord && definition.requirement === 'optional') {
      return {
        serviceKey,
        providerKey: 'disabled',
        values: {},
        version: 0,
        requirement: 'optional',
        availability: 'disabled',
      };
    }
    if (deploymentRecord && runtimeRecord && deploymentRecord.providerKey !== runtimeRecord.providerKey) {
      throw new ServiceConfigurationValidationError(`Runtime provider '${runtimeRecord.providerKey}' does not match deployment provider '${deploymentRecord.providerKey}' for service '${serviceKey}'.`);
    }
    const providerKey = deploymentRecord?.providerKey ?? runtimeRecord?.providerKey;

    if (!providerKey) {
      throw new ServiceConfigurationValidationError(`Service '${serviceKey}' has no provider configured.`);
    }
    const provider = definition.providers.find((candidate) => candidate.key === providerKey);
    if (!provider) {
      throw new ServiceConfigurationValidationError(`Provider '${providerKey}' is not registered for service '${serviceKey}'.`);
    }

    const values = { ...(deploymentRecord?.values ?? {}), ...(runtimeRecord?.values ?? {}) };
    const resolvedValues: Record<string, unknown> = {};
    const knownKeys = new Set(provider.fields.map((field) => field.key));
    for (const key of Object.keys(values)) {
      if (!knownKeys.has(key)) {
        throw new ServiceConfigurationValidationError(`Configuration '${serviceKey}.${key}' is not registered for provider '${providerKey}'.`);
      }
    }
    for (const field of provider.fields) {
      const value = values[field.key];
      if (value === undefined || value === null || value === '') {
        if (field.required) throw new ServiceConfigurationValidationError(`Required configuration '${serviceKey}.${field.key}' is missing.`);
        continue;
      }
      resolvedValues[field.key] = field.secret && resolveSecrets
        ? await this.resolveSecret(value, serviceKey, field)
        : value;
    }
    this.validateValues(provider.fields, resolvedValues, serviceKey);

    return {
      serviceKey,
      providerKey,
      values: resolvedValues,
      version: runtimeRecord?.version ?? 1,
      requirement: definition.requirement ?? 'required',
      availability: providerKey === 'disabled' ? 'disabled' : 'configured',
      ...(runtimeRecord?.updatedAt ? { updatedAt: runtimeRecord.updatedAt } : {}),
    };
  }

  async getPublic(serviceKey: ServiceConfigurationKey): Promise<PublicServiceConfiguration> {
    const effective = await this.resolve(serviceKey, false);
    const definition = this.registry.get(serviceKey);
    const provider = this.provider(definition, effective.providerKey);
    const visibleFields = new Map(provider.fields.filter((field) => field.clientVisible).map((field) => [field.key, field]));
    const values = Object.fromEntries(Object.entries(effective.values).filter(([key]) => visibleFields.has(key)));
    return {
      serviceKey,
      providerKey: effective.providerKey,
      values,
      version: effective.version,
      restartRequired: provider.fields.some((field) => field.restartRequired && Object.hasOwn(effective.values, field.key)),
      requirement: effective.requirement,
      availability: effective.availability,
      reload: definition.reload ?? 'process-restart',
      fallback: definition.fallback ?? 'none',
      dependencies: definition.dependencies ?? [],
    };
  }

  private provider(definition: ServiceConfigurationDefinition, providerKey: string) {
    const provider = definition.providers.find((candidate) => candidate.key === providerKey);
    if (!provider) throw new ServiceConfigurationValidationError(`Provider '${providerKey}' is not registered for service '${definition.key}'.`);
    return provider;
  }

  private async resolveSecret(value: unknown, serviceKey: ServiceConfigurationKey, field: ServiceConfigurationFieldDefinition): Promise<string> {
    if (typeof value !== 'string' || !value.startsWith('secret://')) {
      throw new ServiceConfigurationValidationError(`Secret '${serviceKey}.${field.key}' must be a secret reference.`);
    }
    if (!this.secrets) throw new ServiceConfigurationValidationError(`Secret resolver is not configured for '${serviceKey}.${field.key}'.`);
    const resolved = await this.secrets.resolve(value);
    if (!resolved) throw new ServiceConfigurationValidationError(`Secret '${serviceKey}.${field.key}' could not be resolved.`);
    return resolved;
  }

  private validateValues(fields: readonly ServiceConfigurationFieldDefinition[], values: Readonly<Record<string, unknown>>, serviceKey: ServiceConfigurationKey): void {
    for (const field of fields) {
      const value = values[field.key];
      if (value === undefined) continue;
      const valid = field.type === 'boolean'
        ? typeof value === 'boolean'
        : field.type === 'integer'
          ? Number.isInteger(value)
          : typeof value === 'string';
      if (!valid) throw new ServiceConfigurationValidationError(`Configuration '${serviceKey}.${field.key}' has an invalid value type.`);
    }
  }
}

export type { ServiceRuntimeConfigurationRecord };
