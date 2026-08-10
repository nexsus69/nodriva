import type { ResourceTypeReference } from './ResourceSchema.js';

export type ResourceAttachmentKind = 'file' | 'image';

export interface ResourceAttachmentReference {
  id: string;
  resource: ResourceTypeReference;
  resourceId: string;
  fieldKey: string;
  kind: ResourceAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksum: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ResourceAttachmentConstraints {
  maxFiles?: number;
  maxSizeBytes?: number;
  acceptedMimeTypes?: readonly string[];
}

export interface ResourceAttachmentSelection {
  name: string;
  type: string;
  size: number;
}

export function validateAttachmentSelection(files: readonly ResourceAttachmentSelection[], constraints: ResourceAttachmentConstraints = {}): string[] {
  const errors: string[] = [];
  if (constraints.maxFiles !== undefined && files.length > constraints.maxFiles) {
    errors.push(`Sono consentiti al massimo ${constraints.maxFiles} file.`);
  }
  for (const file of files) {
    if (constraints.maxSizeBytes !== undefined && file.size > constraints.maxSizeBytes) {
      errors.push(`${file.name}: dimensione massima superata.`);
    }
    if (constraints.acceptedMimeTypes?.length && !constraints.acceptedMimeTypes.includes(file.type)) {
      errors.push(`${file.name}: formato non consentito.`);
    }
  }
  return errors;
}
