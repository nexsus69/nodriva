/** Converts resource metadata into the shared form renderer contract. */
import type { FormEvent, ReactNode } from "react";
import type { ResourceFieldDefinition } from "@dashboard/core";
import {
  FormRenderer,
  type FormDefinition,
  type FormFieldLayout,
  type FormFieldSchema,
  type FormOption,
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

export function buildResourceFormSchema(
  fields: readonly ResourceFieldDefinition[],
  options: ResourceFieldOptionsMap = {},
): FormFieldSchema[] {
  return fields.map((field) => {
    const dataType = field.dataType.toLowerCase();
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
    if (dataType === "relation" && field.relationTarget)
      return {
        name: field.fieldKey,
        type: "relation",
        label: field.label,
        required: field.isRequired,
        resourceType: field.relationTarget.resourceType,
        typeKey: field.relationTarget.typeKey,
        layout: options[field.fieldKey]?.layout,
      };
    if (dataType === "enum" || dataType === "relation")
      return {
        name: field.fieldKey,
        type: "select",
        label: field.label,
        required: field.isRequired,
        options: options[field.fieldKey]?.options ?? [],
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
}

export interface ResourceFormRendererProps {
  fields: readonly ResourceFieldDefinition[];
  options?: ResourceFieldOptionsMap;
  definition?: Omit<FormDefinition, "fields" | "key" | "version"> & {
    key?: string;
    version?: string;
  };
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPending?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  children?: ReactNode;
}

export function ResourceFormRenderer({
  fields,
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
        fields: buildResourceFormSchema(fields, options),
        sections: definition?.sections,
        layout: definition?.layout,
      }}
    />
  );
}
