/** Verifies intent-specific service projections and disabled/unavailable semantics. */
import { describe, expect, it } from 'vitest';
import type { PublicServiceConfiguration } from '@dashboard/core';
import { providerLabel, servicePresentationStatus, servicesForScope } from './serviceOperationsModel';

const service = (serviceKey: PublicServiceConfiguration['serviceKey'], availability: PublicServiceConfiguration['availability'] = 'configured'): PublicServiceConfiguration => ({
  serviceKey,
  providerKey: availability === 'disabled' ? 'disabled' : 'postgres',
  values: {},
  version: 1,
  restartRequired: false,
  requirement: 'optional',
  availability,
  reload: 'hot',
  fallback: 'disabled',
  dependencies: [],
});

describe('service operations model', () => {
  it('groups the shared catalogue by administrative intent without dropping health coverage', () => {
    const services = [service('database'), service('realtime'), service('backup'), service('observability')];
    expect(servicesForScope(services, 'integrations').map((entry) => entry.serviceKey)).toEqual(['realtime', 'observability']);
    expect(servicesForScope(services, 'recovery').map((entry) => entry.serviceKey)).toEqual(['database', 'backup']);
    expect(servicesForScope(services, 'health')).toHaveLength(4);
  });

  it('distinguishes an intentionally disabled service from an unavailable health adapter', () => {
    expect(servicePresentationStatus(service('realtime', 'disabled'))).toBe('disabled');
    expect(servicePresentationStatus(service('backup'), {
      serviceKey: 'backup', providerKey: 'postgres-dump', status: 'not-configured', checkedAt: new Date(),
    })).toBe('unavailable');
  });

  it('uses a safe technical fallback for a provider unknown to this client version', () => {
    expect(providerLabel('future-provider', (key) => key)).toBe('future-provider');
  });
});
