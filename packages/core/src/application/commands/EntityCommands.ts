import { z } from 'zod';

export const CreateEntityCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  parentNodeId: z.string().uuid(),
  entityTypeKey: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  payload: z.record(z.unknown()),
  expectedParentRowVersion: z.number().int().positive().optional(),
});

export type CreateEntityCommand = z.infer<typeof CreateEntityCommandSchema>;

export const UpdateEntityCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  payloadDelta: z.record(z.unknown()).optional(),
  expectedRowVersion: z.number().int().positive(),
});

export type UpdateEntityCommand = z.infer<typeof UpdateEntityCommandSchema>;

export const DeleteEntityCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  entityId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
});

export type DeleteEntityCommand = z.infer<typeof DeleteEntityCommandSchema>;
