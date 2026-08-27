/** Defines the serializable visual contract used to construct application forms. */
export type FormLabelPosition = "top" | "inline" | "hidden";

/** Describes how one field occupies the form grid and participates in a row. */
export interface FormFieldLayout {
  row?: string;
  order?: number;
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  labelPosition?: FormLabelPosition;
  className?: string;
}

/** Defines one independently visible validation requirement for a form field. */
export interface FormFieldRule {
  kind:
    | "pattern"
    | "minLength"
    | "maxLength"
    | "email"
    | "min"
    | "max"
    | "step";
  value?: string | number;
  /** Optional override for a domain-specific message. */
  message?: string;
}

/** Defines the shared declarative validation rules for every form control. */
export interface FormFieldValidation {
  rules?: readonly FormFieldRule[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  email?: boolean;
}

/** Localized templates used when the renderer generates standard rule messages. */
export interface FormValidationMessages {
  required: string;
  pattern: string;
  selectPlaceholder: string;
  searchOptions: string;
  minLength: (count: number) => string;
  maxLength: (count: number) => string;
  email: string;
  min: (value: number) => string;
  max: (value: number) => string;
  step: (value: number) => string;
}

/** Creates the standard localized messages shared by every definition-driven form. */
export function createValidationMessages(t: (key: string) => string): FormValidationMessages {
  return {
    required: t("admin.validationRequired"),
    pattern: t("admin.validationInvalid"),
    selectPlaceholder: t("admin.selectValue"),
    searchOptions: t("admin.searchOptions"),
    minLength: (count) => t("admin.validationMinLength").replace("{count}", String(count)),
    maxLength: (count) => t("admin.validationMaxLength").replace("{count}", String(count)),
    email: t("admin.validationEmail"),
    min: (value) => `${t("admin.validationMin")} ${value}`,
    max: (value) => `${t("admin.validationMax")} ${value}`,
    step: (value) => `${t("admin.validationStep")} ${value}`,
  };
}

/** Defines a named visual group of fields inside a form. */
export interface FormSectionDefinition {
  key: string;
  label?: string;
  description?: string;
  fieldNames: readonly string[];
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  className?: string;
}

/** Controls the default grid used when a field does not define its own span. */
export interface FormLayoutDefinition {
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: "compact" | "normal" | "spacious";
}

/** Describes one node in a definition-driven hierarchical selector. */
export interface FormTreeNodeOption {
  id: string;
  parentId: string | null;
  name: string;
  pathLabel: string;
}

/** Provides localized copy required by the reusable node tree control. */
export interface FormNodeTreeLabels {
  instruction: string;
  empty: string;
  loading?: string;
  dropPlaceholder: string;
  expand: string;
  collapse: string;
}

/** Describes a complete form independently from the component that renders it. */
export interface FormDefinition<TValues = Record<string, unknown>> {
  key: string;
  version: string;
  fields: readonly FormFieldSchema[];
  sections?: readonly FormSectionDefinition[];
  layout?: FormLayoutDefinition;
  validationMessages?: FormValidationMessages;
  valueType?: TValues;
}

/** Creates a typed form definition while keeping its runtime representation serializable. */
export function defineForm<TValues = Record<string, unknown>>(
  definition: FormDefinition<TValues>,
): FormDefinition<TValues> {
  for (const field of definition.fields) {
    const validation = field.validation as
      | (FormFieldValidation & { required?: unknown })
      | undefined;
    if (validation && Object.hasOwn(validation, "required")) {
      throw new Error(
        `Field "${field.name}" must declare required on the field itself.`,
      );
    }
    if (validation?.rules?.some((rule) => (rule as { kind: string }).kind === "required")) {
      throw new Error(
        `Field "${field.name}" must not declare required as a validation rule.`,
      );
    }
    if (field.type === "nodeTree") {
      const nodeIds = field.nodes.map((node) => node.id);
      if (new Set(nodeIds).size !== nodeIds.length) {
        throw new Error(
          `Field "${field.name}" must declare unique node IDs.`,
        );
      }
    }
  }
  return definition;
}

import type { AttachmentInputProps } from "./AttachmentInput";

/** Shared properties applied to every supported form control. */
interface FormFieldBase {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  /** Prevents editing while preserving the field's value in a read-only form. */
  disabled?: boolean;
  validation?: FormFieldValidation;
  layout?: FormFieldLayout;
}

/** Describes the supported field controls and their control-specific options. */
export type FormFieldSchema = FormFieldBase &
  (
    | {
        type: "text" | "email" | "password";
        placeholder?: string;
        autoComplete?: string;
      }
    | { type: "select"; options: readonly FormOption[]; placeholder?: string; searchable?: boolean }
    | {
        type: "nodeTree";
        nodes: readonly FormTreeNodeOption[];
        labels: FormNodeTreeLabels;
        loading?: boolean;
        interaction?: "drag-drop" | "direct" | "both";
      }
    | {
        type: "relation";
        resourceType: "node" | "entity";
        typeKey: string;
        multiple?: boolean;
        placeholder?: string;
      }
    | { type: "textarea"; placeholder?: string; rows?: number }
    | {
        type: "date" | "datetime-local";
        placeholder?: string;
        autoComplete?: string;
      }
    | {
        type: "number";
        min?: number;
        step?: number;
        placeholder?: string;
        autoComplete?: string;
      }
    | { type: "boolean" }
    | {
        type: "attachment";
        kind: AttachmentInputProps["kind"];
        maxFiles?: number;
        maxSizeBytes?: number;
        acceptedMimeTypes?: readonly string[];
      }
  );

/** Defines one selectable value in a select control. */
export interface FormOption {
  value: string;
  label: string;
  /** Explains a semantic choice while keeping its technical value secondary. */
  description?: string;
  /** Additional normalized terms used by the shared catalogue search. */
  keywords?: readonly string[];
}
