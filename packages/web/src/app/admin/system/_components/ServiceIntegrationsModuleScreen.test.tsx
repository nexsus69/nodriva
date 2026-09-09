import { describe, expect, it } from 'vitest';
import type { PublicServiceConfiguration, ServiceHealthCheckResult } from '@dashboard/core';
import { createServiceOperationsColumns } from './ServiceIntegrationsModuleScreen';

const service: PublicServiceConfiguration & { id: string } = {
  id: 'realtime',
  serviceKey: 'realtime',
  providerKey: 'soketi',
  values: {},
  version: 1,
  restartRequired: false,
  requirement: 'optional',
  availability: 'configured',
  fallback: 'disabled',
  reload: 'hot',
  dependencies: [],
};

describe('ServiceIntegrationsModuleScreen health columns', () => {
  it('reads a completed check from stable columns without recreating the resource definition', () => {
    let health: Record<string, ServiceHealthCheckResult> = {};
    const columns = createServiceOperationsColumns((key) => key, () => ({ health, healthFailures: new Set() }));
    const availability = columns.find((column) => column.key === 'availability');

    expect(availability?.sortValue?.(service)).toBe('configured');
    health = {
      realtime: {
        serviceKey: 'realtime', providerKey: 'soketi', status: 'healthy', checkedAt: new Date('2026-09-09T00:00:00.000Z'),
      },
    };
    expect(availability?.sortValue?.(service)).toBe('healthy');
  });
});
