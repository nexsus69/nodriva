import type { TypeDomain } from '../dto/TypeFieldDefinition.js';

/**
 * A canonical directed relationship edge. The relation field metadata owns the
 * edge, while source and target domains disambiguate otherwise equal UUIDs.
 */
export interface ResourceRelationshipEdge {
  sourceFieldId: string;
  sourceDomain: TypeDomain;
  sourceResourceId: string;
  targetDomain: TypeDomain;
  targetResourceId: string;
  position: number;
  sourceCardinality: 'one' | 'many';
  targetIsUnique: boolean;
  suspendedAt: Date | null;
}

export interface ResourceRelationshipResource {
  domain: TypeDomain;
  resourceId: string;
}

/**
 * Stable total lock order for relationship resources: entity, then node, then
 * canonical UUID lexicographically ASC. Both adapters apply it before
 * multi-target work; do not replace this with locale-dependent collation.
 */
export function sortRelationshipResources(resources: readonly ResourceRelationshipResource[]): ResourceRelationshipResource[] {
  return [...new Map(resources.map((resource) => [`${resource.domain}:${resource.resourceId}`, resource])).values()]
    .sort((left, right) => relationshipDomainOrder[left.domain] - relationshipDomainOrder[right.domain]
      || compareCanonicalResourceIds(left.resourceId, right.resourceId));
}

export function sortRelationshipResourceIds(resourceIds: readonly string[]): string[] {
  return [...new Set(resourceIds)].sort(compareCanonicalResourceIds);
}

const relationshipDomainOrder: Record<TypeDomain, number> = { entity: 0, node: 1 };

function compareCanonicalResourceIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Input used to replace the complete, ordered value of one relation field. */
export interface ReplaceResourceRelationshipValues {
  sourceFieldId: string;
  sourceDomain: TypeDomain;
  sourceResourceId: string;
  targetDomain: TypeDomain;
  targetResourceIds: readonly string[];
  sourceCardinality: 'one' | 'many';
  targetIsUnique: boolean;
}

/**
 * Persistence boundary for canonical resource relationship edges.
 * Implementations participate in the caller's transaction and never perform
 * authorization or type validation, which remain application responsibilities.
 */
export interface ResourceRelationshipRepository {
  /** Existing full-history read; callers that need live links must opt in below. */
  listOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]>;
  listIncoming(targetDomain: TypeDomain, targetResourceId: string): Promise<ResourceRelationshipEdge[]>;
  listActiveOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]>;
  listActiveIncomingForTargets(targets: readonly ResourceRelationshipResource[]): Promise<ResourceRelationshipEdge[]>;
  suspendActiveOutgoingForSources(sources: readonly ResourceRelationshipResource[], deletionBatchId: string): Promise<void>;
  restoreSuspendedOutgoingForSources(sources: readonly ResourceRelationshipResource[], deletionBatchId: string): Promise<void>;
  /** Locks active deletion targets before restrict is evaluated. */
  lockActiveTargets(targets: readonly ResourceRelationshipResource[]): Promise<void>;
  /** Acquires the database protection needed to ensure targets remain active through edge persistence. */
  assertTargetsActive(targetDomain: TypeDomain, targetResourceIds: readonly string[]): Promise<void>;
  replaceValues(values: ReplaceResourceRelationshipValues): Promise<void>;
  removeForResource(domain: TypeDomain, resourceId: string): Promise<void>;
}
