import { z } from "zod";

// ─── Domain Types & Enums ───────────────────────────────────────────────────

export type TypeKind = "node" | "entity";

export type FieldDataType =
  | "string"
  | "text"
  | "integer"
  | "number"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "uuid"
  | "json"
  | "enum"
  | "relation"
  | "array"
  | "file"
  | "image";
export type RelationTargetDomain = "node" | "entity";
export type EnumMode = "static" | "managed";
export type FieldEncryptionMode = "plaintext" | "encrypted";

export type ConstraintType =
  | "min"
  | "max"
  | "min_length"
  | "max_length"
  | "regex"
  | "enum"
  | "precision"
  | "scale";

// ─── Read DTOs ──────────────────────────────────────────────────────────────

export interface FieldConstraintDto {
  id: string;
  constraintType: ConstraintType;
  constraintValueText: string;
}

export interface EnumOptionDto {
  id: string;
  value: string;
  label: string;
  position: number;
  isActive: boolean;
}

export interface FieldDto {
  id: string;
  fieldKey: string;
  label: string;
  columnName: string;
  dataType: FieldDataType;
  relationTargetDomain?: RelationTargetDomain | null;
  relationTargetTypeKey?: string | null;
  enumMode?: EnumMode | null;
  encryptionMode: FieldEncryptionMode;
  enumOptions?: EnumOptionDto[];
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  defaultValueText: string | null;
  position: number;
  isSystem: boolean;
  constraints: FieldConstraintDto[];
  updatedAt: string; // ISO 8601
}

export interface TypeListItemDto {
  id: string;
  kind: TypeKind;
  typeKey: string;
  name: string;
  description: string;
  storageTable: string | null;
  currentSchemaVersion: number;
  isActive: boolean;
  isSystem: boolean;
  rowVersion: number;
  fieldCount: number;
  updatedAt: string; // ISO 8601
}

export interface TypeDetailDto {
  id: string;
  kind: TypeKind;
  typeKey: string;
  name: string;
  description: string;
  storageTable: string | null;
  placementPolicyId: string | null;
  currentSchemaVersion: number;
  isActive: boolean;
  isSystem: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  fields: FieldDto[];
  // Metadata per la UX
  isEditable: boolean;
  isDeletable: boolean;
  instanceCount: number;
}

export interface TypeSchemaImpactDto {
  operation:
    | "add_field"
    | "update_field"
    | "remove_field"
    | "disable_type"
    | "enable_type";
  currentSchemaVersion: number;
  nextSchemaVersion: number;
  instanceCount: number;
  fieldCount: number;
  isActive: boolean;
  fieldKey: string | null;
  fieldHasValues: boolean | null;
  incomingRelationCount: number;
  blockingReasons: string[];
  warnings: string[];
}

export interface TypeSchemaRollbackPlanDto {
  auditId: string;
  sourceActionKey: string;
  canApply: boolean;
  reason: string;
  currentSchemaVersion: number;
  targetSchemaVersion: number;
  targetName: string | null;
  targetDescription: string | null;
}

// ─── Write Commands & Zod Schemas ───────────────────────────────────────────

export const CreateTypeCommandSchema = z.object({
  kind: z.enum(["node", "entity"]),
  typeKey: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(128),
  description: z.string().max(500).optional(),
  storageTable: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  placementPolicyId: z.string().uuid().optional(),
});
export type CreateTypeCommand = z.infer<typeof CreateTypeCommandSchema>;
export type CreateTypeUiCommand = CreateTypeCommand;

export const UpdateTypeCommandSchema = z.object({
  name: z.string().min(2).max(128),
  description: z.string().max(500),
  expectedRowVersion: z.number().int().positive(),
});
export type UpdateTypeCommand = z.infer<typeof UpdateTypeCommandSchema>;
export type UpdateTypeUiCommand = UpdateTypeCommand;

export const DisableTypeCommandSchema = z.object({
  expectedRowVersion: z.number().int().positive(),
});
export type DisableTypeCommand = z.infer<typeof DisableTypeCommandSchema>;
export type DisableTypeUiCommand = DisableTypeCommand;

export const CreateFieldCommandSchema = z
  .object({
    fieldKey: z
      .string()
      .min(2)
      .max(64)
      .regex(
        /^[a-z][a-z0-9_]*$/,
        "Usa solo snake_case minuscolo, ad esempio customer_id.",
      ),
    label: z.string().min(1).max(128),
    columnName: z
      .string()
      .min(2)
      .max(64)
      .regex(
        /^[a-z][a-z0-9_]*$/,
        "Usa solo snake_case minuscolo, ad esempio customer_id.",
      ),
    dataType: z.enum([
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
    ]),
    relationTargetDomain: z.enum(["node", "entity"]).optional(),
    relationTargetTypeKey: z
      .string()
      .min(2)
      .max(64)
      .regex(
        /^[a-z][a-z0-9_-]*$/,
        "Usa solo caratteri minuscoli, numeri, underscore o trattino, ad esempio customer-info.",
      )
      .optional(),
    enumMode: z.enum(["static", "managed"]).optional(),
    encryptionMode: z.enum(["plaintext", "encrypted"]).optional(),
    isRequired: z.boolean().optional(),
    isUnique: z.boolean().optional(),
    isIndexed: z.boolean().optional(),
    defaultValueText: z.string().nullable().optional(),
    position: z.number().int().nonnegative().optional(),
    expectedTypeRowVersion: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (
      value.dataType === "relation" &&
      (!value.relationTargetDomain || !value.relationTargetTypeKey)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relationTargetTypeKey"],
        message: "Il tipo target è obbligatorio per una relazione.",
      });
    }
  });
export type CreateFieldCommand = z.infer<typeof CreateFieldCommandSchema>;
export type CreateFieldUiCommand = CreateFieldCommand;

export const UpdateFieldCommandSchema = z.object({
  fieldId: z.string().uuid(),
  label: z.string().min(1).max(128).optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isIndexed: z.boolean().optional(),
  defaultValueText: z.string().nullable().optional(),
  encryptionMode: z.enum(["plaintext", "encrypted"]).optional(),
  position: z.number().int().nonnegative().optional(),
  expectedTypeRowVersion: z.number().int().positive(),
});
export type UpdateFieldCommand = z.infer<typeof UpdateFieldCommandSchema>;
export type UpdateFieldUiCommand = UpdateFieldCommand;

export const DeleteFieldCommandSchema = z.object({
  fieldId: z.string().uuid(),
  expectedTypeRowVersion: z.number().int().positive(),
});
export type DeleteFieldCommand = z.infer<typeof DeleteFieldCommandSchema>;
export type DeleteFieldUiCommand = DeleteFieldCommand;

export const ReorderFieldsCommandSchema = z.object({
  orderedFieldIds: z.array(z.string().uuid()).min(1),
  expectedTypeRowVersion: z.number().int().positive(),
});
export type ReorderFieldsCommand = z.infer<typeof ReorderFieldsCommandSchema>;
export type ReorderFieldsUiCommand = ReorderFieldsCommand;

// ─── Error Response Contract ────────────────────────────────────────────────

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  code:
    | "ROW_VERSION_MISMATCH"
    | "SYSTEM_TYPE_FORBIDDEN"
    | "SYSTEM_FIELD_FORBIDDEN"
    | "DUPLICATE_TYPE_KEY"
    | "DUPLICATE_FIELD_KEY"
    | "DUPLICATE_COLUMN_NAME"
    | "TYPE_HAS_INSTANCES"
    | "TYPE_FIELD_HAS_VALUES"
    | "DUPLICATE_EMAIL"
    | "DUPLICATE_ROLE_KEY"
    | "USER_NOT_FOUND"
    | "PLACEMENT_POLICY_NOT_FOUND"
    | "DUPLICATE_PLACEMENT_POLICY_KEY"
    | "AUDIT_LOG_NOT_FOUND"
    | "ENTITY_NOT_FOUND"
    | "ENTITY_TYPE_NOT_FOUND"
    | "NODE_NOT_FOUND"
    | "NODE_TYPE_NOT_FOUND"
    | "NODE_PATH_COLLISION"
    | "NODE_CYCLIC_MOVE"
    | "LOCK_CONFLICT"
    | "LOCK_NOT_FOUND"
    | "LOCK_EXPIRED"
    | "LOCK_FORBIDDEN"
    | "LOCK_REQUIRED"
    | "CAPABILITY_DISABLED"
    | "VALIDATION_ERROR"
    | "ROLLBACK_NOT_SUPPORTED"
    | "ACCESS_FORBIDDEN"
    | "AUTH_UNAUTHORIZED"
    | "NOT_FOUND"
    | "INTERNAL_ERROR"
    | "UNKNOWN_ERROR";
  message: string;
  /** Stable key used to render the message in the requested locale. */
  messageKey?: string;
  /** Primitive interpolation values kept separate from localized text. */
  messageParams?: Record<string, string | number | boolean>;
  target?: string;
  expectedRowVersion?: number;
  currentRowVersion?: number;
  details?: ApiErrorDetail[];
}
