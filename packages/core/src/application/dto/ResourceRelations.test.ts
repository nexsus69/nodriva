import { describe, expect, it } from 'vitest';
import { resourceContainmentRule, resourceRelationDefinition } from './ResourceRelations.js';

describe('resource relations', () => {
  const project = { resourceType: 'node' as const, typeKey: 'project' };
  const task = { resourceType: 'entity' as const, typeKey: 'task' };

  it('describes references independently from persistence', () => {
    expect(resourceRelationDefinition(project, task, {
      kind: 'reference',
      cardinality: 'one-to-many',
      fieldKey: 'tasks',
    })).toEqual({
      source: project,
      target: task,
      kind: 'reference',
      cardinality: 'one-to-many',
      fieldKey: 'tasks',
    });
  });

  it('describes allowed recursive containment rules', () => {
    expect(resourceContainmentRule(project, project, { recursive: true })).toEqual({
      parent: project,
      child: project,
      recursive: true,
      allowed: true,
    });
  });
});
