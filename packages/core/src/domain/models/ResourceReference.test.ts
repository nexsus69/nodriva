import { describe, expect, it } from 'vitest';
import { resourceReference } from './ResourceReference.js';

describe('resourceReference', () => {
  it('creates a shared identity without changing persistence models', () => {
    expect(resourceReference('node', 'node-1')).toEqual({ resourceType: 'node', resourceId: 'node-1' });
    expect(resourceReference('entity', 'entity-1')).toEqual({ resourceType: 'entity', resourceId: 'entity-1' });
  });
});
