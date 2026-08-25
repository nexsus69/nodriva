/** Converts resource metadata into the shared form renderer contract. */
import type { ResourceFieldDefinition } from "@dashboard/core";
import {
  FormRenderer,
  type FormDefinition,
  type FormFieldLayout,
  type FormFieldSchema,
  type FormOption,
  type FormRendererProps,
} from "./FormRenderer";

const NUMBER_TYPES = new Set([
  "number",
  "integer",
  "decimal",
  "numeric",
  "float",
  "double",
]);

export interface ResourceFieldOptions {
  options?: readonly FormOption[];
  layout?: FormFieldLayout;
  attachment?: {
    maxFiles?: number;
    maxSizeBytes?: number;
    acceptedMimeTypes?: readonly string[];
  };
}

export type ResourceFieldOptionsMap = Readonly<
  Record<string, ResourceFieldOptions>
>;

/**
 * Describes metadata from either the Core resource contract or the authorized
 * type-definition read model. Both shapes are normalized before rendering.
 */
export type ResourceFormFieldDefinition = Omit<
  ResourceFieldDefinition,
  "relationTarget"
> & {
  relationTarget?: ResourceFieldDefinition["relationTarget"];
  enumOptions?: readonly ResourceFormOption[];
  relationTargetDomain?: "node" | "entity" | null;
  relationTargetTypeKey?: string | null;
};

/** Preserves optional active-state metadata while remaining a form option. */
interface ResourceFormOption extends FormOption {
  isActive?: boolean;
}

/** Resolves either supported relation representation to the canonical target. */
function resolveRelationTarget(field: ResourceFormFieldDefinition) {
  if (field.relationTarget) return field.relationTarget;
  if (!field.relationTargetDomain || !field.relationTargetTypeKey) return null;
  return {
    resourceType: field.relationTargetDomain,
    typeKey: field.relationTargetTypeKey,
  } as const;
}

/** Selects configured enum options first, otherwise exposes active metadata values. */
function resolveEnumOptions(
  field: ResourceFormFieldDefinition,
  options: ResourceFieldOptionsMap,
): readonly FormOption[] {
  const configuredOptions = options[field.fieldKey]?.options;
  if (configuredOptions) return configuredOptions;
  const metadataOptions = (field.enumOptions ?? [])
    .filter((option) => option.isActive !== false)
    .map(({ value, label }) => ({ value, label }));
  if (metadataOptions.length > 0) return metadataOptions;

  const legacyEnumConstraint = field.constraints.find((constraint) => {
    if (!constraint || typeof constraint !== "object") return false;
    return Reflect.get(constraint, "constraintType") === "enum";
  });
  const rawValues = legacyEnumConstraint && typeof legacyEnumConstraint === "object"
    ? Reflect.get(legacyEnumConstraint, "constraintValueText")
    : undefined;
  if (typeof rawValues !== "string") return [];
  return rawValues
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({ value, label: value }));
}

/** Builds one shared UI schema from the metadata of a node or entity type. */
export function buildResourceFormSchema(
  fields: readonly ResourceFormFieldDefinition[],
  options: ResourceFieldOptionsMap = {},
): FormFieldSchema[] {
  const schema: FormFieldSchema[] = fields.map((field): FormFieldSchema => {
    const dataType = field.dataType.toLowerCase();
    const relationTarget = resolveRelationTarget(field);
    if (dataType === "boolean")
      return {
        name: field.fieldKey,
        type: "boolean",
        label: field.label,
        layout: options[field.fieldKey]?.layout,
      };
    if (dataType === "file" || dataType === "image")
      return {
        name: field.fieldKey,
        type: "attachment",
        label: field.label,
        required: field.isRequired,
        kind: dataType,
        layout: options[field.fieldKey]?.layout,
        ...options[field.fieldKey]?.attachment,
      };
    if (dataType === "relation" && relationTarget)
      return {
        name: field.fieldKey,
        type: "relation",
        label: field.label,
        required: field.isRequired,
        resourceType: relationTarget.resourceType,
        typeKey: relationTarget.typeKey,
        ...(field.relationSourceCardinality === "many" ? { multiple: true } : {}),
        layout: options[field.fieldKey]?.layout,
      };
    if (dataType === "enum" || dataType === "relation")
      return {
        name: field.fieldKey,
        type: "select",
        label: field.label,
        required: field.isRequired,
        options: dataType === "enum"
          ? resolveEnumOptions(field, options)
          : options[field.fieldKey]?.options ?? [],
        layout: options[field.fieldKey]?.layout,
      };
    if (dataType === "date")
      return {
        name: field.fieldKey,
        type: "date",
        label: field.label,
        required: field.isRequired,
        layout: options[field.fieldKey]?.layout,
      };
    if (dataType === "datetime" || dataType === "timestamp")
      return {
        name: field.fieldKey,
        type: "datetime-local",
        label: field.label,
        required: field.isRequired,
        layout: options[field.fieldKey]?.layout,
      };
    if (NUMBER_TYPES.has(dataType))
      return dataType === "integer"
        ? {
            name: field.fieldKey,
            type: "number",
            label: field.label,
            required: field.isRequired,
            step: 1,
            layout: options[field.fieldKey]?.layout,
          }
        : {
            name: field.fieldKey,
            type: "number",
            label: field.label,
            required: field.isRequired,
            layout: options[field.fieldKey]?.layout,
          };
    if (dataType === "json" || dataType === "array")
      return {
        name: field.fieldKey,
        type: "textarea",
        label: field.label,
        required: field.isRequired,
        rows: 4,
        layout: options[field.fieldKey]?.layout,
      };
    if (dataType === "uuid")
      return {
        name: field.fieldKey,
        type: "text",
        label: field.label,
        required: field.isRequired,
        placeholder: "UUID",
        layout: options[field.fieldKey]?.layout,
      };
    return {
      name: field.fieldKey,
      type: "text",
      label: field.label,
      required: field.isRequired,
      layout: options[field.fieldKey]?.layout,
    };
  });

  return schema.map(withoutUndefinedLayout);
}

/** Keeps generated schemas structurally stable when a caller has no layout override. */
function withoutUndefinedLayout(field: FormFieldSchema): FormFieldSchema {
  if (field.layout !== undefined) return field;
  const schema = { ...field } as { layout?: FormFieldLayout } & FormFieldSchema;
  delete schema.layout;
  return schema as FormFieldSchema;
}

/**
 * Configures a complete resource editor from stable fields plus dynamic type
 * metadata. Consumers only bind draft values and callbacks; the renderer owns
 * field construction, layout, validation presentation, and action geometry.
 */
export interface ResourceFormRendererProps extends Omit<
  FormRendererProps,
  "definition" | "fields"
> {
  fields: readonly ResourceFormFieldDefinition[];
  baseFields?: readonly FormFieldSchema[];
  options?: ResourceFieldOptionsMap;
  definition?: Omit<FormDefinition, "fields" | "key" | "version"> & {
    key?: string;
    version?: string;
  };
}

export function ResourceFormRenderer({
  fields,
  baseFields = [],
  options,
  definition,
  ...props
}: ResourceFormRendererProps) {
  return (
    <FormRenderer
      {...props}
      definition={{
        key: definition?.key ?? "resource-form",
        version: definition?.version ?? "1",
        fields: [...baseFields, ...buildResourceFormSchema(fields, options)],
        sections: definition?.sections,
        layout: definition?.layout,
      }}
    />
  );
}
