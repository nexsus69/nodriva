/** Verifies every pure relationship impact independently from persistence. */

import { describe, expect, it } from 'vitest';
import { RelationshipMutationImpactPolicy } from './RelationshipMutationImpactPolicy.js';

const policy = new RelationshipMutationImpactPolicy();

describe('RelationshipMutationImpactPolicy', () => {
  it.each([
    ['one', 'link', [], 'target-a', 'add', ['target-a'], false],
    ['one', 'link', ['target-a'], 'target-a', 'no_change', ['target-a'], false],
    ['one', 'link', ['target-a'], 'target-b', 'replace', ['target-b'], true],
    ['one', 'unlink', ['target-a'], 'target-a', 'remove', [], false],
    ['one', 'unlink', ['target-a'], 'target-b', 'no_change', ['target-a'], false],
    ['many', 'link', [], 'target-a', 'append', ['target-a'], false],
    ['many', 'link', ['target-a'], 'target-a', 'no_change', ['target-a'], false],
    ['many', 'link', ['target-a'], 'target-b', 'append', ['target-a', 'target-b'], false],
    ['many', 'unlink', ['target-a', 'target-b'], 'target-a', 'remove', ['target-b'], false],
    ['many', 'unlink', ['target-a'], 'target-b', 'no_change', ['target-a'], false],
  ] as const)(
    '%s %s from %j to %s is %s',
    (cardinality, operation, currentTargetIds, targetResourceId, expectedKind, expectedAfter, requiresConfirmation) => {
      const impact = policy.evaluate({ cardinality, operation, currentTargetIds, targetResourceId });

      expect(impact).toMatchObject({
        kind: expectedKind,
        beforeTargetIds: currentTargetIds,
        afterTargetIds: expectedAfter,
        requiresConfirmation,
      });
    },
  );

  it('normalizes duplicate canonical ids without changing their first-occurrence order', () => {
    const impact = policy.evaluate({
      cardinality: 'many',
      operation: 'link',
      currentTargetIds: ['target-a', 'target-a', 'target-b'],
      targetResourceId: 'target-c',
    });

    expect(impact.beforeTargetIds).toEqual(['target-a', 'target-b']);
    expect(impact.afterTargetIds).toEqual(['target-a', 'target-b', 'target-c']);
  });
});
