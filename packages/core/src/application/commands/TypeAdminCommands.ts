import { z } from 'zod';

const DomainSchema = z.enum(['node', 'entity']);

// --- Type Commands ---

export const CreateTypeCommandSchema = z.object({
  domain: DomainSchema,
  typeKey: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1).max(150),
  description: z.string().optional().default(''),
  storageTable: z.string().min(1).max(150).regex(/^[a-z][a-z0-9_]*$/).optional(),
  placementPolicyId: z.string().uuid().nullable().optional(),
  actorUserId: z.string().uuid(),
});
export type CreateTypeCommand = z.input<typeof CreateTypeCommandSchema>;

export const UpdateTypeCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  expectedRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type UpdateTypeCommand = z.infer<typeof UpdateTypeCommandSchema>;

export const DisableTypeCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
  actorUserId: z.string().uuid(),
});
export type DisableTypeCommand = z.infer<typeof DisableTypeCommandSchema>;

export const EnableTypeCommandSchema = DisableTypeCommandSchema;
export type EnableTypeCommand = z.infer<typeof EnableTypeCommandSchema>;

// --- Field Commands ---

export const AddFieldCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  fieldKey: z.string().min(1, 'La chiave campo è obbligatoria.').max(100).regex(/^[a-z][a-z0-9_]*$/, 'Usa solo snake_case minuscolo, ad esempio customer_id.'),
  label: z.string().min(1).max(150),
  columnName: z.string().min(1, 'Il nome colonna è obbligatorio.').max(100).regex(/^[a-z][a-z0-9_]*$/, 'Usa solo snake_case minuscolo, ad esempio customer_id.'),
  dataType: z.enum([
    'string', 'text', 'integer', 'number', 'decimal', 'boolean', 'date', 'datetime',
    'uuid', 'json', 'enum', 'relation', 'array', 'file', 'image',
  ]),
  relationTargetDomain: DomainSchema.nullable().optional(),
  relationTargetTypeKey: z.string().min(2, 'Il type key target deve contenere almeno 2 caratteri.').max(64).regex(/^[a-z][a-z0-9_-]*$/, 'Usa solo caratteri minuscoli, numeri, underscore o trattino, ad esempio customer-info.').nullable().optional(),
  relationSourceCardinality: z.enum(['one', 'many']).default('one'),
  relationTargetIsUnique: z.boolean().default(false),
  relationInverseLabel: z.string().min(1).max(150).nullable().optional(),
  enumMode: z.enum(['static', 'managed']).nullable().optional(),
  encryptionMode: z.enum(['plaintext', 'encrypted']).optional(),
  isRequired: z.boolean().default(false),
  isUnique: z.boolean().default(false),
  isIndexed: z.boolean().default(false),
  defaultValueText: z.string().nullable().optional(),
  position: z.number().int().nonnegative(),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type AddFieldCommand = z.input<typeof AddFieldCommandSchema>;

export const AddEnumOptionCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  fieldId: z.string().uuid(),
  value: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_-]*$/),
  label: z.string().min(1).max(150),
  position: z.number().int().nonnegative().default(0),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type AddEnumOptionCommand = z.input<typeof AddEnumOptionCommandSchema>;

export const UpdateFieldCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  fieldId: z.string().uuid(),
  label: z.string().min(1).max(150).optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isIndexed: z.boolean().optional(),
  defaultValueText: z.string().nullable().optional(),
  encryptionMode: z.enum(['plaintext', 'encrypted']).optional(),
  position: z.number().int().nonnegative().optional(),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type UpdateFieldCommand = z.infer<typeof UpdateFieldCommandSchema>;

export const RemoveFieldCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  fieldId: z.string().uuid(),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type RemoveFieldCommand = z.infer<typeof RemoveFieldCommandSchema>;

// --- Constraint Commands ---

export const AddConstraintCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  fieldId: z.string().uuid(),
  constraintType: z.enum(['min', 'max', 'min_length', 'max_length', 'regex', 'enum', 'precision', 'scale']),
  constraintValueText: z.string().min(1),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type AddConstraintCommand = z.infer<typeof AddConstraintCommandSchema>;

export const UpdateConstraintCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  constraintId: z.string().uuid(),
  constraintValueText: z.string().min(1),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type UpdateConstraintCommand = z.infer<typeof UpdateConstraintCommandSchema>;

export const RemoveConstraintCommandSchema = z.object({
  domain: DomainSchema,
  typeId: z.string().uuid(),
  constraintId: z.string().uuid(),
  expectedTypeRowVersion: z.number().int().positive().optional(),
  actorUserId: z.string().uuid(),
});
export type RemoveConstraintCommand = z.infer<typeof RemoveConstraintCommandSchema>;
