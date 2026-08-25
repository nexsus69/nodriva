import type { TypeDomain } from '../dto/TypeFieldDefinition.js';

/**
 * Metadata describing a relation field that points to a resource type.
 *
 * This is intentionally separate from relationship-edge persistence: field
 * definitions describe what may be connected, while the edge repository
 * stores what is connected.
 */
export interface IncomingResourceRelationshipDefinition {
  sourceDomain: TypeDomain;
  sourceTypeKey: string;
  sourceTypeName: string;
  sourceFieldId: string;
  sourceFieldKey: string;
  sourceFieldLabel: string;
  sourceCardinality: 'one' | 'many';
  targetIsUnique: boolean;
  inverseLabel: string | null;
}

/** Reads active relation-field metadata without exposing a persistence dialect. */
export interface ResourceRelationshipDefinitionReader {
  listIncomingDefinitions(
    targetDomain: TypeDomain,
    targetTypeKey: string,
  ): Promise<IncomingResourceRelationshipDefinition[]>;
}
