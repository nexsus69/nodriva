import { describe, expect, it } from 'vitest';
import { resourceContainmentRule } from './ResourceRelations.js';
import { resourceTypeReference } from './ResourceSchema.js';
import { TypeDefinition, TypeFieldDefinition } from './TypeFieldDefinition.js';

describe('resource schema references', () => {
  it('creates a shared type reference', () => {
    expect(resourceTypeReference('entity', 'customer')).toEqual({ resourceType: 'entity', typeKey: 'customer' });
  });

  it('derives relation and type references from existing definitions', () => {
    const field = new TypeFieldDefinition('owner', 'relation', true, [], 'entity', 'customer');
    const definition = new TypeDefinition('type-1', 'node', 'project', 'Project', '', 1, [field]);

    expect(field.relationTarget).toEqual({ resourceType: 'entity', typeKey: 'customer' });
    expect(definition.resourceTypeReference).toEqual({ resourceType: 'node', typeKey: 'project' });
    expect(definition.relationDefinitions).toEqual([
      {
        source: { resourceType: 'node', typeKey: 'project' },
        target: { resourceType: 'entity', typeKey: 'customer' },
        kind: 'reference',
        cardinality: 'many-to-one',
        fieldKey: 'owner',
      },
    ]);

    const containment = resourceContainmentRule(definition.resourceTypeReference, definition.resourceTypeReference, { recursive: true });
    const withContainment = new TypeDefinition('type-2', 'node', 'folder', 'Folder', '', 1, [], [containment]);
    expect(withContainment.containmentRules).toEqual([containment]);
  });
});
