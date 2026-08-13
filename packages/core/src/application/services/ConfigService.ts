import type {
  ConfigurationDefinition,
  ConfigurationRegistry,
} from '../config/ConfigurationRegistry.js';
import type {
  ConfigurationRecord,
  ConfigurationRepository,
} from '../ports/ConfigurationRepository.js';

export interface SessionTimingPolicy {
  sessionIdleTimeoutSeconds: number;
  sessionUpdateAgeSeconds: number;
  lockTtlSeconds: number;
  syncPollingIntervalSeconds: number;
}

interface CacheEntry {
  record: ConfigurationRecord;
  expiresAt: number;
}

export class ConfigService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly repository: ConfigurationRepository,
    private readonly registry: ConfigurationRegistry,
    private readonly cacheTtlMs = 5_000,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<T> {
    const definition = this.registry.get<T>(key);
    if (definition.source === 'derived') {
      throw new Error(`Derived configuration '${key}' cannot be read as a stored value.`);
    }

    const cached = this.cache.get(key);
    const record = cached && cached.expiresAt > this.now()
      ? cached.record
      : await this.load(definition);
    return record.value as T;
  }

  async set<T>(key: string, value: T, expectedVersion: number): Promise<ConfigurationRecord> {
    const definition = this.registry.get<T>(key);
    if (definition.source !== 'runtime') {
      throw new Error(`Configuration '${key}' is not runtime-editable.`);
    }
    definition.validate(value);
    const record = await this.repository.set(key, value, expectedVersion);
    this.cache.set(key, { record, expiresAt: this.now() + this.cacheTtlMs });
    return record;
  }

  async getSessionTimingPolicy(): Promise<SessionTimingPolicy> {
    const sessionIdleTimeoutSeconds = await this.get<number>('session.idleTimeoutSeconds');
    const sessionUpdateAgeSeconds = Math.max(1, Math.floor(sessionIdleTimeoutSeconds / 6));
    return {
      sessionIdleTimeoutSeconds,
      sessionUpdateAgeSeconds,
      lockTtlSeconds: sessionUpdateAgeSeconds * 2,
      syncPollingIntervalSeconds: sessionUpdateAgeSeconds,
    };
  }

  invalidate(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  private async load<T>(definition: ConfigurationDefinition<T>): Promise<ConfigurationRecord> {
    const stored = await this.repository.get(definition.key);
    const record = stored ?? {
      key: definition.key,
      value: definition.defaultValue,
      version: 1,
    };
    definition.validate(record.value as T);
    this.cache.set(definition.key, { record, expiresAt: this.now() + this.cacheTtlMs });
    return record;
  }
}
