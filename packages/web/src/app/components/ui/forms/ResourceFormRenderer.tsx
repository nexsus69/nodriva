import type { FormEvent, ReactNode } from 'react';
import type { ResourceFieldDefinition } from '@dashboard/core';
import { FormRenderer, type FormFieldSchema, type FormOption } from './FormRenderer';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

export interface ResourceFieldOptions {
  options?: readonly FormOption[];
}

export type ResourceFieldOptionsMap = Readonly<Record<string, ResourceFieldOptions>>;

export function buildResourceFormSchema(fields: readonly ResourceFieldDefinition[], options: ResourceFieldOptionsMap = {}): FormFieldSchema[] {
  return fields.map((field) => {
    const dataType = field.dataType.toLowerCase();
    if (dataType === 'boolean') return { name: field.fieldKey, type: 'boolean', label: field.label };
    if (dataType === 'enum' || dataType === 'relation') return { name: field.fieldKey, type: 'select', label: field.label, required: field.isRequired, options: options[field.fieldKey]?.options ?? [] };
    if (NUMBER_TYPES.has(dataType)) return dataType === 'integer'
      ? { name: field.fieldKey, type: 'number', label: field.label, required: field.isRequired, step: 1 }
      : { name: field.fieldKey, type: 'number', label: field.label, required: field.isRequired };
    if (dataType === 'json') return { name: field.fieldKey, type: 'textarea', label: field.label, required: field.isRequired, rows: 4 };
    return { name: field.fieldKey, type: 'text', label: field.label, required: field.isRequired };
  });
}

export interface ResourceFormRendererProps {
  fields: readonly ResourceFieldDefinition[];
  options?: ResourceFieldOptionsMap;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPending?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  children?: ReactNode;
}

export function ResourceFormRenderer({ fields, options, ...props }: ResourceFormRendererProps) {
  return <FormRenderer {...props} fields={buildResourceFormSchema(fields, options)} />;
}
