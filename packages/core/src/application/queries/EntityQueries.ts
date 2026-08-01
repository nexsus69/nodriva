import { z } from 'zod';

export const GetEntityByIdQuerySchema = z.object({
  entityId: z.string().uuid(),
});

export type GetEntityByIdQuery = z.infer<typeof GetEntityByIdQuerySchema>;

export const ListEntitiesByNodeQuerySchema = z.object({
  parentNodeId: z.string().uuid(),
  entityTypeKey: z.string().optional(),
  cursor: z.string().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export type ListEntitiesByNodeQuery = z.infer<typeof ListEntitiesByNodeQuerySchema>;
