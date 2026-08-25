import type { DynamicField } from './DynamicFieldsForm';
import { uploadResourceAttachment, validateResourceAttachmentFile } from '../../../attachments/attachmentClient';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);
const ATTACHMENT_TYPES = new Set(['file', 'image']);
const OPTIONAL_EMPTY_TO_NULL_TYPES = new Set([
  ...NUMBER_TYPES,
  'date', 'datetime', 'timestamp', 'uuid', 'enum', 'relation', 'array',
]);

export const isAttachmentField = (field: DynamicField) => ATTACHMENT_TYPES.has(field.dataType.toLowerCase());

export function initializeDynamicPayload(fields: readonly DynamicField[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => !isAttachmentField(field)).map((field) => [
    field.fieldKey,
    field.dataType.toLowerCase() === 'boolean'
      ? false
      : field.dataType.toLowerCase() === 'relation' && field.relationSourceCardinality === 'many'
        ? []
        : '',
  ]));
}

export function coerceDynamicPayload(fields: readonly DynamicField[], payload: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => !isAttachmentField(field)).map((field) => {
    const value = payload[field.fieldKey];
    const type = field.dataType.toLowerCase();
    if (type === 'relation' && field.relationSourceCardinality === 'many') {
      return [field.fieldKey, Array.isArray(value) ? value : []];
    }
    if (!field.isRequired && value === '' && OPTIONAL_EMPTY_TO_NULL_TYPES.has(type)) {
      return [field.fieldKey, null];
    }
    if (NUMBER_TYPES.has(type)) {
      if (value === '' || value === null || value === undefined) return [field.fieldKey, null];
      const numericValue = Number(value);
      return [field.fieldKey, Number.isNaN(numericValue) ? value : numericValue];
    }
    return [field.fieldKey, type === 'boolean' ? Boolean(value) : value];
  }));
}

export async function validateDynamicAttachments(fields: readonly DynamicField[], filesByField: Readonly<Record<string, readonly File[]>>): Promise<void> {
  for (const field of fields.filter(isAttachmentField)) for (const file of filesByField[field.fieldKey] ?? []) {
    const error = await validateResourceAttachmentFile(file, field.dataType.toLowerCase() as 'file' | 'image');
    if (error) throw new Error(error);
  }
}

export async function uploadDynamicAttachments(resourceType: 'node' | 'entity', resourceId: string, fields: readonly DynamicField[], filesByField: Readonly<Record<string, readonly File[]>>): Promise<void> {
  for (const field of fields.filter(isAttachmentField)) for (const file of filesByField[field.fieldKey] ?? []) {
    await uploadResourceAttachment({ resourceType, resourceId, fieldKey: field.fieldKey, kind: field.dataType.toLowerCase() as 'file' | 'image', file });
  }
}
