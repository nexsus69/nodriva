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
    | "required"
    | "pattern"
    | "minLength"
    | "maxLength"
    | "email"
    | "min"
    | "max"
    | "step";
  value?: string | number;
  message: string;
}

/** Defines the shared declarative validation rules for every form control. */
export interface FormFieldValidation {
  rules?: readonly FormFieldRule[];
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  email?: boolean;
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

/** Describes a complete form independently from the component that renders it. */
export interface FormDefinition<TValues = Record<string, unknown>> {
  key: string;
  version: string;
  fields: readonly FormFieldSchema[];
  sections?: readonly FormSectionDefinition[];
  layout?: FormLayoutDefinition;
  valueType?: TValues;
}

/** Creates a typed form definition while keeping its runtime representation serializable. */
export function defineForm<TValues = Record<string, unknown>>(
  definition: FormDefinition<TValues>,
): FormDefinition<TValues> {
  return definition;
}

import type { AttachmentInputProps } from "./AttachmentInput";

/** Shared properties applied to every supported form control. */
interface FormFieldBase {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
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
    | { type: "select"; options: readonly FormOption[] }
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
}
