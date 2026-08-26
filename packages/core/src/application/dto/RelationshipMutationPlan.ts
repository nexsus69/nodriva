/** Declares the serializable application preview used before a relationship batch commits. */

import type { MutateResourceRelationshipCommand } from '../commands/ResourceRelationshipCommands.js';
import type { TypeDomain } from './TypeFieldDefinition.js';
import type { RelationshipMutationImpact } from '../../domain/policies/RelationshipMutationImpactPolicy.js';

/** Stable relation metadata required by a prepared batch mutation. */
export interface RelationshipMutationFieldPlan {
  id: string;
  key: string;
  sourceCardinality: 'one' | 'many';
  targetDomain: TypeDomain;
  targetTypeKey: string;
  targetIsUnique: boolean;
}

/** A source snapshot and its calculated impact at the time of preparation. */
export interface RelationshipMutationPlanItem {
  resourceId: string;
  expectedRowVersion: number;
  currentRowVersion: number;
  impact: RelationshipMutationImpact;
}

/**
 * A non-durable preview of a transactional relationship mutation.
 *
 * It is intentionally a snapshot rather than a reservation: commit always
 * prepares it again inside its transaction and verifies every row version.
 */
export interface RelationshipMutationPlan {
  intent: MutateResourceRelationshipCommand;
  field: RelationshipMutationFieldPlan;
  items: readonly RelationshipMutationPlanItem[];
  replacementSourceIds: readonly string[];
  unavailableSourceIds?: readonly string[];
}
