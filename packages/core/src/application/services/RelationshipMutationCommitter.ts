/** Commits previously planned relationship changes after their explicit review. */

import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { RelationshipMutationPlan } from '../dto/RelationshipMutationPlan.js';
import type { ResourceRelationshipRepository } from '../ports/ResourceRelationshipRepository.js';
import type {
  RelationshipMutationResource,
  ResourceRelationshipMutationWriter,
} from './ResourceRelationshipMutationWriter.js';

export interface RelationshipMutationCommitOptions {
  acceptedReplacementSourceIds?: readonly string[];
}

export interface RelationshipMutationResult {
  changedResources: RelationshipMutationResource[];
}

/**
 * Commits an already prepared relationship plan after explicit replacement
 * confirmation. The caller owns the surrounding transaction and re-prepares
 * the plan inside that transaction before invoking this object.
 */
export class RelationshipMutationCommitter {
  constructor(
    private readonly relationshipRepository: ResourceRelationshipRepository,
    private readonly writer: ResourceRelationshipMutationWriter,
  ) {}

  async commit(
    plan: RelationshipMutationPlan,
    options: RelationshipMutationCommitOptions = {},
  ): Promise<RelationshipMutationResult> {
    this.assertReplacementConfirmation(plan, options.acceptedReplacementSourceIds ?? []);
    await this.assertTargetUniqueness(plan);

    const changedResources: RelationshipMutationResource[] = [];
    for (const item of [...plan.items].sort((left, right) => left.resourceId.localeCompare(right.resourceId))) {
      const changed = await this.writer.write(plan, item);
      if (changed) changedResources.push(changed);
    }
    return { changedResources };
  }

  private assertReplacementConfirmation(
    plan: RelationshipMutationPlan,
    acceptedReplacementSourceIds: readonly string[],
  ): void {
    const accepted = new Set(acceptedReplacementSourceIds);
    const missing = plan.replacementSourceIds.filter((resourceId) => !accepted.has(resourceId));
    if (missing.length === 0) return;

    throw new ValidationError('Explicit confirmation is required before replacing relationship values.', {
      sources: ['One or more selected resources already reference a different value.'],
    });
  }

  private async assertTargetUniqueness(plan: RelationshipMutationPlan): Promise<void> {
    if (!plan.field.targetIsUnique || plan.intent.operation !== 'link') return;

    const existing = await this.relationshipRepository.listIncoming(
      plan.intent.targetDomain,
      plan.intent.targetResourceId,
    );
    const sourceIds = new Set(plan.items.map((item) => item.resourceId));
    const conflictingEdge = existing.find((edge) => edge.sourceFieldId === plan.field.id && !sourceIds.has(edge.sourceResourceId));
    if (conflictingEdge) {
      throw new ValidationError('The selected target is already linked by another source.', {
        [plan.field.key]: ['The target is unique for this relationship.'],
      });
    }
  }
}
