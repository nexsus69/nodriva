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
  listOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]>;
  listIncoming(targetDomain: TypeDomain, targetResourceId: string): Promise<ResourceRelationshipEdge[]>;
  replaceValues(values: ReplaceResourceRelationshipValues): Promise<void>;
  removeForResource(domain: TypeDomain, resourceId: string): Promise<void>;
}
