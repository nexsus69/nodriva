/** Validates administrative security mutations at the application boundary. */
import { z } from 'zod';

export const CreateRoleCommandSchema = z.object({
  roleKey: z.string().min(2).max(100).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
  actorUserId: z.string().uuid(),
});
export type CreateRoleCommand = z.infer<typeof CreateRoleCommandSchema>;

export const UpdateRolePermissionsCommandSchema = z.object({
  roleKey: z.string().min(2).max(100),
  permissionIds: z.array(z.string().uuid()),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdateRolePermissionsCommand = z.infer<typeof UpdateRolePermissionsCommandSchema>;

export const UpdateRoleMetadataCommandSchema = z.object({
  roleKey: z.string().min(2).max(100),
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdateRoleMetadataCommand = z.infer<typeof UpdateRoleMetadataCommandSchema>;

/** Validates the atomic metadata and permission update for one role. */
export const UpdateRoleCommandSchema = z.object({
  roleKey: z.string().min(2).max(100),
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdateRoleCommand = z.infer<typeof UpdateRoleCommandSchema>;

export const CreateScopeAssignmentCommandSchema = z.object({
  userId: z.string().uuid(),
  nodeId: z.string().uuid(),
  roleId: z.string().uuid(),
  assignmentEffect: z.enum(['allow', 'deny']),
  propagation: z.enum(['self', 'subtree']),
  actorUserId: z.string().uuid(),
});
export type CreateScopeAssignmentCommand = z.infer<typeof CreateScopeAssignmentCommandSchema>;

export const DeleteScopeAssignmentCommandSchema = z.object({
  assignmentId: z.string().uuid(),
  actorUserId: z.string().uuid(),
});
export type DeleteScopeAssignmentCommand = z.infer<typeof DeleteScopeAssignmentCommandSchema>;

export const UpdateScopeAssignmentCommandSchema = z.object({
  assignmentId: z.string().uuid(),
  roleId: z.string().uuid(),
  assignmentEffect: z.enum(['allow', 'deny']),
  propagation: z.enum(['self', 'subtree']),
  actorUserId: z.string().uuid(),
});
export type UpdateScopeAssignmentCommand = z.infer<typeof UpdateScopeAssignmentCommandSchema>;
