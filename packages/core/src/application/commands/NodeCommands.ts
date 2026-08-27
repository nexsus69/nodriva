/** Validates node lifecycle commands without treating containment as a mutable parent record. */
import { z } from 'zod';

export const CreateNodeCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  parentNodeId: z.string().uuid().nullable(),
  nodeTypeKey: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type CreateNodeCommand = z.infer<typeof CreateNodeCommandSchema>;

export const UpdateNodeCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  nodeId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  expectedRowVersion: z.number().int().positive(),
  payloadDelta: z.record(z.unknown()).optional(),
});

export type UpdateNodeCommand = z.infer<typeof UpdateNodeCommandSchema>;

export const MoveNodeCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  nodeId: z.string().uuid(),
  newParentNodeId: z.string().uuid().nullable(),
  expectedNodeRowVersion: z.number().int().positive().optional(),
});

export type MoveNodeCommand = z.infer<typeof MoveNodeCommandSchema>;

export const DeleteNodeCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  nodeId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
});

export type DeleteNodeCommand = z.infer<typeof DeleteNodeCommandSchema>;

export const RestoreNodeCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  nodeId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
});

export type RestoreNodeCommand = z.infer<typeof RestoreNodeCommandSchema>;
