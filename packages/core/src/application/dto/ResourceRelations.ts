import type { ResourceTypeReference } from './ResourceSchema.js';

export type ResourceRelationKind = 'reference' | 'containment';
export type ResourceRelationCardinality = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

export interface ResourceRelationDefinition {
  source: ResourceTypeReference;
  target: ResourceTypeReference;
  kind: ResourceRelationKind;
  cardinality: ResourceRelationCardinality;
  fieldKey?: string;
}

export interface ResourceContainmentRule {
  parent: ResourceTypeReference;
  child: ResourceTypeReference;
  recursive: boolean;
  allowed: boolean;
}

export function resourceRelationDefinition(source: ResourceTypeReference, target: ResourceTypeReference, options: Pick<ResourceRelationDefinition, 'kind' | 'cardinality'> & Partial<Pick<ResourceRelationDefinition, 'fieldKey'>>): ResourceRelationDefinition {
  return { source, target, ...options };
}

export function resourceContainmentRule(parent: ResourceTypeReference, child: ResourceTypeReference, options: Partial<Pick<ResourceContainmentRule, 'recursive' | 'allowed'>> = {}): ResourceContainmentRule {
  return { parent, child, recursive: options.recursive ?? false, allowed: options.allowed ?? true };
}
