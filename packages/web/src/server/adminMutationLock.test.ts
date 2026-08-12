import { describe, expect, it } from 'vitest';
import { administrativeLockResourceId } from './adminMutationLock';

describe('administrativeLockResourceId', () => {
  it('keeps UUID resource identities unchanged', () => {
    const id = '7e490773-4682-419d-9efd-61868e24b3f0';
    expect(administrativeLockResourceId('entity_type', id)).toBe(id);
  });

  it('maps the same text key to a stable UUID-shaped lock identity', () => {
    const first = administrativeLockResourceId('entity_type', 'asset_record');
    const second = administrativeLockResourceId('entity_type', 'asset_record');
    const otherKind = administrativeLockResourceId('node_type', 'asset_record');

    expect(first).toBe(second);
    expect(first).not.toBe(otherKind);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
