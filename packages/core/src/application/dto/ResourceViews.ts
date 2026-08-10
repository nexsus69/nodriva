import type { ResourceTypeReference } from './ResourceSchema.js';

export type ResourceViewColumnKind = 'text' | 'number' | 'boolean' | 'date';
export type ResourceFilterKind = 'text' | 'select' | 'boolean';

export interface ResourceViewColumn {
  key: string;
  label: string;
  kind?: ResourceViewColumnKind;
  sortable?: boolean;
}

export interface ResourceFilterDefinition {
  key: string;
  label: string;
  kind: ResourceFilterKind;
  options?: readonly { value: string; label: string }[];
}

export interface ResourceViewDefinition {
  key: string;
  resource: ResourceTypeReference;
  columns: readonly ResourceViewColumn[];
  filters?: readonly ResourceFilterDefinition[];
}

export interface ResourceActionDefinition {
  key: string;
  label: string;
  permission?: string;
  destructive?: boolean;
}

export function resourceViewDefinition(
  key: string,
  resource: ResourceTypeReference,
  columns: readonly ResourceViewColumn[],
  filters: readonly ResourceFilterDefinition[] = []
): ResourceViewDefinition {
  return { key, resource, columns, filters };
}

export function resourceActionDefinition(
  key: string,
  label: string,
  options: Omit<ResourceActionDefinition, 'key' | 'label'> = {}
): ResourceActionDefinition {
  return { key, label, ...options };
}
