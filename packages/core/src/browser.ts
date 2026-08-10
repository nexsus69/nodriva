/**
 * Browser-safe public surface.
 *
 * Keep this entrypoint limited to DTOs, types and pure functions. Server
 * adapters and Node-only dependencies must never be exported from here.
 */
export { resourceTypeReference } from './application/dto/ResourceSchema.js';
export type { ResourceTypeReference, ResourceFieldDefinition } from './application/dto/ResourceSchema.js';
export { resourceRelationDefinition, resourceContainmentRule } from './application/dto/ResourceRelations.js';
export type {
  ResourceRelationDefinition,
  ResourceRelationKind,
  ResourceRelationCardinality,
  ResourceContainmentRule,
} from './application/dto/ResourceRelations.js';
export { resourceViewDefinition, resourceActionDefinition } from './application/dto/ResourceViews.js';
export type {
  ResourceViewColumn,
  ResourceViewColumnKind,
  ResourceFilterDefinition,
  ResourceFilterKind,
  ResourceViewDefinition,
  ResourceActionDefinition,
} from './application/dto/ResourceViews.js';
export { validateAttachmentSelection } from './application/dto/ResourceAttachment.js';
export type {
  ResourceAttachmentKind,
  ResourceAttachmentReference,
  ResourceAttachmentConstraints,
  ResourceAttachmentSelection,
} from './application/dto/ResourceAttachment.js';
