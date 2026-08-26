/** Defines pure cardinality semantics for canonical relationship mutations. */

/** Describes the operation requested against one canonical relationship value. */
export type RelationshipMutationOperation = 'link' | 'unlink';

/** Describes the observable result of a relationship operation for one source. */
export type RelationshipMutationImpactKind =
  | 'add'
  | 'append'
  | 'replace'
  | 'remove'
  | 'no_change';

/** Input required to calculate a relationship change without reading persistence. */
export interface RelationshipMutationImpactInput {
  cardinality: 'one' | 'many';
  operation: RelationshipMutationOperation;
  currentTargetIds: readonly string[];
  targetResourceId: string;
}

/** Immutable preview of the value before and after one requested relationship change. */
export interface RelationshipMutationImpact {
  kind: RelationshipMutationImpactKind;
  beforeTargetIds: readonly string[];
  afterTargetIds: readonly string[];
  requiresConfirmation: boolean;
}

/**
 * Calculates relationship effects from canonical ids only.
 *
 * This policy deliberately has no persistence, authorization or UI dependency,
 * so the same cardinality semantics are used by previews and committed writes.
 */
export class RelationshipMutationImpactPolicy {
  evaluate(input: RelationshipMutationImpactInput): RelationshipMutationImpact {
    const beforeTargetIds = uniqueIds(input.currentTargetIds);
    const targetIsPresent = beforeTargetIds.includes(input.targetResourceId);

    if (input.cardinality === 'one') {
      return this.evaluateSingleValue(input, beforeTargetIds, targetIsPresent);
    }

    if (input.operation === 'link') {
      return targetIsPresent
        ? unchanged(beforeTargetIds)
        : impact('append', beforeTargetIds, [...beforeTargetIds, input.targetResourceId]);
    }

    return targetIsPresent
      ? impact('remove', beforeTargetIds, beforeTargetIds.filter((id) => id !== input.targetResourceId))
      : unchanged(beforeTargetIds);
  }

  private evaluateSingleValue(
    input: RelationshipMutationImpactInput,
    beforeTargetIds: readonly string[],
    targetIsPresent: boolean,
  ): RelationshipMutationImpact {
    const currentTargetId = beforeTargetIds[0] ?? null;
    if (input.operation === 'unlink') {
      return targetIsPresent
        ? impact('remove', beforeTargetIds, [])
        : unchanged(beforeTargetIds);
    }

    if (currentTargetId === null) {
      return impact('add', beforeTargetIds, [input.targetResourceId]);
    }
    if (targetIsPresent) {
      return unchanged(beforeTargetIds);
    }
    return impact('replace', beforeTargetIds, [input.targetResourceId], true);
  }
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function unchanged(beforeTargetIds: readonly string[]): RelationshipMutationImpact {
  return impact('no_change', beforeTargetIds, beforeTargetIds);
}

function impact(
  kind: RelationshipMutationImpactKind,
  beforeTargetIds: readonly string[],
  afterTargetIds: readonly string[],
  requiresConfirmation = false,
): RelationshipMutationImpact {
  return { kind, beforeTargetIds, afterTargetIds, requiresConfirmation };
}
