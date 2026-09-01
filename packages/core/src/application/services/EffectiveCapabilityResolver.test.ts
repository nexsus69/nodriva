/** Verifies deployment and runtime policy composition for optional service capabilities. */
import { describe, expect, it, vi } from 'vitest';
import { EffectiveCapabilityResolver } from './EffectiveCapabilityResolver.js';

const configuration = (providerKey: string, availability: 'configured' | 'disabled' | 'not-configured', values: Record<string, unknown>) => ({
  get: vi.fn().mockResolvedValue({ serviceKey: 'realtime', providerKey, availability, values }),
  registryDefinition: vi.fn().mockReturnValue({ key: 'realtime', capabilityKey: 'realtime' }),
}) as never;

describe('EffectiveCapabilityResolver', () => {
  it('disables optional services missing from deployment', async () => {
    const resolver = new EffectiveCapabilityResolver(configuration('disabled', 'disabled', {}));
    await expect(resolver.resolve('realtime')).resolves.toMatchObject({ status: 'disabled', reason: 'provider-disabled' });
  });

  it('honours a runtime disabled policy over a configured provider', async () => {
    const resolver = new EffectiveCapabilityResolver(configuration('soketi', 'configured', { enabled: false }));
    await expect(resolver.resolve('realtime')).resolves.toMatchObject({ status: 'disabled', reason: 'runtime-disabled' });
  });

  it('enables a configured provider when no runtime disable is present', async () => {
    const resolver = new EffectiveCapabilityResolver(configuration('soketi', 'configured', {}));
    await expect(resolver.isEnabled('realtime')).resolves.toBe(true);
  });
});
