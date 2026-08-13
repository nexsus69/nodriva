import { describe, expect, it, vi } from 'vitest';
import { ConfigurationRegistry, attachmentAntivirusEnabledDefinition, attachmentEncryptionEnabledDefinition, sessionIdleTimeoutDefinition } from '../config/ConfigurationRegistry.js';
import type { ConfigurationRepository } from '../ports/ConfigurationRepository.js';
import { ConfigService } from './ConfigService.js';

describe('ConfigService', () => {
  it('uses the default and derives the session timing policy', async () => {
    const repository: ConfigurationRepository = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = new ConfigService(repository, new ConfigurationRegistry([sessionIdleTimeoutDefinition]));
    await expect(service.getSessionTimingPolicy()).resolves.toEqual({
      sessionIdleTimeoutSeconds: 1800,
      sessionUpdateAgeSeconds: 300,
      lockTtlSeconds: 600,
      syncPollingIntervalSeconds: 300,
    });
  });

  it('caches reads and validates runtime updates', async () => {
    const repository: ConfigurationRepository = {
      get: vi.fn().mockResolvedValue({ key: sessionIdleTimeoutDefinition.key, value: 600, version: 2 }),
      set: vi.fn().mockResolvedValue({ key: sessionIdleTimeoutDefinition.key, value: 900, version: 3 }),
    };
    const service = new ConfigService(repository, new ConfigurationRegistry([sessionIdleTimeoutDefinition]));
    await expect(service.get<number>(sessionIdleTimeoutDefinition.key)).resolves.toBe(600);
    await expect(service.get<number>(sessionIdleTimeoutDefinition.key)).resolves.toBe(600);
    expect(repository.get).toHaveBeenCalledTimes(1);
    await expect(service.set(sessionIdleTimeoutDefinition.key, 900, 2)).resolves.toMatchObject({ version: 3 });
    await expect(service.set(sessionIdleTimeoutDefinition.key, 10, 3)).rejects.toThrow();
    expect(repository.set).toHaveBeenCalledTimes(1);
  });

  it('defines antivirus as a server-only runtime capability', () => {
    expect(attachmentAntivirusEnabledDefinition.defaultValue).toBe(false);
    expect(attachmentAntivirusEnabledDefinition.clientVisible).toBe(false);
    expect(() => attachmentAntivirusEnabledDefinition.validate(true)).not.toThrow();
    expect(() => attachmentAntivirusEnabledDefinition.validate('true' as never)).toThrow();
    expect(attachmentEncryptionEnabledDefinition.key).toBe('attachments.encryptionEnabled');
    expect(attachmentEncryptionEnabledDefinition.defaultValue).toBe(false);
  });
});
