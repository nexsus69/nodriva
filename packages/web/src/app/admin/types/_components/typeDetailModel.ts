import type { FieldDataType } from "@dashboard/core";
import {
  createValidationMessages,
  type FormDefinition,
  type FormFieldSchema,
} from "@/app/components/ui/forms";
import { fieldDataTypeOption } from "@/adminPanel/adminSemanticCatalog";

/** Represents the editable values shared by create and update field surfaces. */
export type FieldForm = {
  fieldKey: string;
  label: string;
  columnName: string;
  dataType: FieldDataType;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  relationTargetDomain: "" | "node" | "entity";
  relationTargetTypeKey: string;
  relationSourceCardinality: "one" | "many";
  relationTargetIsUnique: boolean;
  relationInverseLabel: string;
  enumMode: "" | "static" | "managed";
  encryptionMode: "plaintext" | "encrypted";
  defaultValueText: string;
};

export const EMPTY_FIELD: FieldForm = {
  fieldKey: "",
  label: "",
  columnName: "",
  dataType: "string",
  isRequired: false,
  isUnique: false,
  isIndexed: false,
  relationTargetDomain: "",
  relationTargetTypeKey: "",
  relationSourceCardinality: "one",
  relationTargetIsUnique: false,
  relationInverseLabel: "",
  enumMode: "",
  encryptionMode: "plaintext",
  defaultValueText: "",
};

export const DATA_TYPES: readonly FieldDataType[] = [
  "string",
  "text",
  "integer",
  "number",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "uuid",
  "json",
  "enum",
  "relation",
  "array",
  "file",
  "image",
];

/** Builds the localized metadata form used by the settings tab. */
export function buildMetadataDefinition(
  t: (key: string) => string,
): FormDefinition {
  return {
    key: "admin.types.detail.metadata",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [
      {
        name: "name",
        type: "text",
        label: t("admin.name"),
        required: true,
      },
      {
        name: "description",
        type: "textarea",
        label: t("admin.description"),
        rows: 4,
      },
    ],
  };
}

/** Builds the localized field definition used by both add and edit dialogs. */
export function buildFieldDefinition(
  t: (key: string) => string,
  options: { dataType: FieldDataType; relationConfigurationDisabled?: boolean },
): FormDefinition {
  const visibleField = (field: FormFieldSchema): boolean => {
    const dataType = options.dataType.toLowerCase();
    const relationControls = new Set([
      "relationTargetDomain",
      "relationTargetTypeKey",
      "relationSourceCardinality",
      "relationTargetIsUnique",
      "relationInverseLabel",
    ]);
    if (relationControls.has(field.name)) return dataType === "relation";
    if (field.name === "enumMode") return dataType === "enum";
    return true;
  };

  return {
    key: "admin.types.detail.field",
    version: "1",
    validationMessages: createValidationMessages(t),
    layout: { columns: 2, gap: "normal" },
    sections: [
      {
        key: "field",
        label: t("admin.fieldDefinition"),
        fieldNames: [
          "fieldKey",
          "label",
          "columnName",
          "dataType",
          "isRequired",
          "isUnique",
          "isIndexed",
        ],
        columns: 2,
      },
    ],
    fields: ([
      {
        name: "fieldKey",
        type: "text",
        label: t("admin.fieldKey"),
        required: true,
        description: t("admin.typeKeyHelp"),
        layout: { row: "identity", colSpan: 1, order: 1 },
        validation: {
          rules: [{
              kind: "pattern",
              value: "^[a-z][a-z0-9_]*$",
              message: t("admin.typeKeyHelp"),
            },
          ],
        },
      },
      {
        name: "columnName",
        type: "text",
        label: t("admin.columnName"),
        required: true,
        description: t("admin.typeKeyHelp"),
        layout: { row: "identity", colSpan: 1, order: 2 },
        validation: {
          rules: [{
              kind: "pattern",
              value: "^[a-z][a-z0-9_]*$",
              message: t("admin.typeKeyHelp"),
            },
          ],
        },
      },
      {
        name: "label",
        type: "text",
        label: t("admin.label"),
        required: true,
        layout: { row: "identity", colSpan: 2, order: 3 },
      },
      {
        name: "dataType",
        type: "select",
        label: t("admin.dataType"),
        options: DATA_TYPES.map((value) => fieldDataTypeOption(value, t)),
        layout: { row: "configuration", colSpan: 2, order: 1 },
      },
      {
        name: "isRequired",
        type: "boolean",
        label: t("admin.requiredField"),
        description: t("admin.requiredFieldHelp"),
        layout: { row: "flags", colSpan: 1, order: 1 },
      },
      {
        name: "isUnique",
        type: "boolean",
        label: t("admin.uniqueField"),
        description: t("admin.uniqueFieldHelp"),
        layout: { row: "flags", colSpan: 1, order: 2 },
      },
      {
        name: "isIndexed",
        type: "boolean",
        label: t("admin.indexedField"),
        description: t("admin.indexedFieldHelp"),
        layout: { row: "flags", colSpan: 1, order: 3 },
      },
      {
        name: "defaultValueText",
        type: "text",
        label: t("admin.defaultValue"),
        layout: { row: "advanced", colSpan: 2, order: 1 },
      },
      {
        name: "encryptionMode",
        type: "select",
        label: t("admin.encryption"),
        options: [
          { value: "plaintext", label: t("admin.plaintext") },
          { value: "encrypted", label: t("admin.encrypted") },
        ],
        layout: { row: "advanced", colSpan: 1, order: 2 },
      },
      {
        name: "relationTargetDomain",
        type: "select",
        label: t("admin.relationTargetDomain"),
        options: [
          { value: "", label: "—" },
          { value: "node", label: t("admin.nodeTypes") },
          { value: "entity", label: t("admin.entityTypes") },
        ],
        layout: { row: "relation", colSpan: 1, order: 1 },
      },
      {
        name: "relationTargetTypeKey",
        type: "text",
        label: t("admin.relationTargetType"),
        disabled: options.relationConfigurationDisabled,
        layout: { row: "relation", colSpan: 1, order: 2 },
      },
      {
        name: "relationSourceCardinality",
        type: "select",
        label: t("admin.relationCardinality"),
        options: [
          { value: "one", label: t("admin.relationOne") },
          { value: "many", label: t("admin.relationMany") },
        ],
        disabled: options.relationConfigurationDisabled,
        layout: { row: "relation", colSpan: 1, order: 3 },
      },
      {
        name: "relationTargetIsUnique",
        type: "boolean",
        label: t("admin.relationTargetUnique"),
        description: t("admin.relationTargetUniqueHelp"),
        disabled: options.relationConfigurationDisabled,
        layout: { row: "relation", colSpan: 1, order: 4 },
      },
      {
        name: "relationInverseLabel",
        type: "text",
        label: t("admin.relationInverseLabel"),
        disabled: options.relationConfigurationDisabled,
        layout: { row: "relation", colSpan: 2, order: 5 },
      },
      {
        name: "enumMode",
        type: "select",
        label: t("admin.enumMode"),
        options: [
          { value: "", label: "—" },
          { value: "static", label: t("admin.enumStatic") },
          { value: "managed", label: t("admin.enumManaged") },
        ],
        layout: { row: "advanced", colSpan: 2, order: 3 },
      },
    ] as FormFieldSchema[]).filter(visibleField),
  };
}
