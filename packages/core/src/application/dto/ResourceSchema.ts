import type { TypeDomain } from './TypeFieldDefinition.js';

/** Shared identity of a configurable node/entity type. */
export interface ResourceTypeReference {
  resourceType: TypeDomain;
  typeKey: string;
}

/** Common schema contract consumed by metadata-driven UI and validation. */
export interface ResourceFieldDefinition {
  fieldKey: string;
  label: string;
  dataType: string;
  isRequired: boolean;
  constraints: readonly unknown[];
  relationTarget: ResourceTypeReference | null;
  relationSourceCardinality?: 'one' | 'many';
  relationTargetIsUnique?: boolean;
  relationInverseLabel?: string | null;
  encryptionMode: 'plaintext' | 'encrypted';
  encryptionCapabilityEnabled?: boolean;
}

export function resourceTypeReference(resourceType: TypeDomain, typeKey: string): ResourceTypeReference {
  return { resourceType, typeKey };
}
