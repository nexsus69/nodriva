import { z } from 'zod';

export const UserPasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters long.')
  .max(128, 'Password must be at most 128 characters long.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/[0-9]/, 'Password must contain a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character.');

export const CreateUserCommandSchema = z.object({
  email: z.string().email(),
  password: UserPasswordSchema,
  isSuperAdmin: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  actorUserId: z.string().uuid(),
});
export type CreateUserCommand = z.infer<typeof CreateUserCommandSchema>;

export const UpdateUserStatusCommandSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdateUserStatusCommand = z.infer<typeof UpdateUserStatusCommandSchema>;

export const AssignUserRolesCommandSchema = z.object({
  userId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type AssignUserRolesCommand = z.infer<typeof AssignUserRolesCommandSchema>;

export const UpdateUserCommandSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  isSuperAdmin: z.boolean(),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdateUserCommand = z.infer<typeof UpdateUserCommandSchema>;

export const ResetUserPasswordCommandSchema = z.object({
  userId: z.string().uuid(),
  newPassword: UserPasswordSchema,
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type ResetUserPasswordCommand = z.infer<typeof ResetUserPasswordCommandSchema>;
