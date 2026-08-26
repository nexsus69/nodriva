/** Verifies confirmation and write ordering for relationship plan commits. */

import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { RelationshipMutationPlan } from '../dto/RelationshipMutationPlan.js';
import { RelationshipMutationCommitter } from './RelationshipMutationCommitter.js';

const sourceId = '11111111-1111-4111-8111-111111111111';

function replacementPlan(): RelationshipMutationPlan {
  return {
    intent: {
      actorUserId: '22222222-2222-4222-8222-222222222222',
      actorSessionId: '33333333-3333-4333-8333-333333333333',
      sourceDomain: 'entity' as const,
      sourceTypeKey: 'task',
      sourceFieldKey: 'document',
      targetDomain: 'entity' as const,
      targetResourceId: '44444444-4444-4444-8444-444444444444',
      operation: 'link' as const,
      sources: [{ resourceId: sourceId, expectedRowVersion: 3 }],
    },
    field: {
      id: 'field-id',
      key: 'document',
      sourceCardinality: 'one' as const,
      targetDomain: 'entity' as const,
      targetTypeKey: 'document',
      targetIsUnique: false,
    },
    items: [{
      resourceId: sourceId,
      expectedRowVersion: 3,
      currentRowVersion: 3,
      impact: {
        kind: 'replace' as const,
        beforeTargetIds: ['55555555-5555-4555-8555-555555555555'],
        afterTargetIds: ['44444444-4444-4444-8444-444444444444'],
        requiresConfirmation: true,
      },
    }],
    replacementSourceIds: [sourceId],
  };
}

describe('RelationshipMutationCommitter', () => {
  it('does not call the writer until every replacement was explicitly accepted', async () => {
    const writer = { write: vi.fn() };
    const committer = new RelationshipMutationCommitter({ listIncoming: vi.fn() } as never, writer as never);

    await expect(committer.commit(replacementPlan())).rejects.toBeInstanceOf(ValidationError);
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('writes planned sources in deterministic order after confirmation', async () => {
    const writer = { write: vi.fn().mockResolvedValue(null) };
    const committer = new RelationshipMutationCommitter({ listIncoming: vi.fn() } as never, writer as never);
    const plan = replacementPlan();
    plan.items = [
      {
        resourceId: 'source-z',
        expectedRowVersion: 3,
        currentRowVersion: 3,
        impact: {
          kind: 'add',
          beforeTargetIds: [],
          afterTargetIds: ['44444444-4444-4444-8444-444444444444'],
          requiresConfirmation: false,
        },
      },
      ...plan.items,
    ];

    await expect(committer.commit(plan, {
      acceptedReplacementSourceIds: [sourceId],
    })).resolves.toEqual({ changedResources: [] });
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(writer.write.mock.calls.map((call) => call[1].resourceId)).toEqual([sourceId, 'source-z']);
  });
});
