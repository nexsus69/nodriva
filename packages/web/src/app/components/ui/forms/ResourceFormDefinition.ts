/** Builds stable identity fields shared by metadata-driven node and entity forms. */
import type { FormFieldSchema, FormOption } from './FormRenderer';

/** Configures the optional type selector and common identity labels of a resource form. */
export interface ResourceIdentityFormOptions {
  type?: {
    name: string;
    label: string;
    options: readonly FormOption[];
    required?: boolean;
  };
  nameLabel: string;
  descriptionLabel: string;
  descriptionRows?: number;
}

/**
 * Creates the standard type, name, and description fields with responsive
 * layout metadata. Dynamic forms append their type-defined fields afterward.
 */
export function buildResourceIdentityFields(
  options: ResourceIdentityFormOptions,
): readonly FormFieldSchema[] {
  const fields: FormFieldSchema[] = [];
  if (options.type) {
    fields.push({
      name: options.type.name,
      type: 'select',
      label: options.type.label,
      required: options.type.required ?? true,
      options: options.type.options,
      layout: { row: 'identity', colSpan: 1, order: 1 },
    });
  }
  fields.push(
    {
      name: 'name',
      type: 'text',
      label: options.nameLabel,
      required: true,
      layout: { row: 'identity', colSpan: 1, order: 2 },
    },
    {
      name: 'description',
      type: 'textarea',
      label: options.descriptionLabel,
      rows: options.descriptionRows ?? 3,
      layout: { row: 'identity', colSpan: 2, order: 3 },
    },
  );
  return fields;
}
