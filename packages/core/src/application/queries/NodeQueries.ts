import { z } from 'zod';

export const GetNodeByIdQuerySchema = z.object({
  nodeId: z.string().uuid(),
});

export type GetNodeByIdQuery = z.infer<typeof GetNodeByIdQuerySchema>;

export const GetNodeSubtreeQuerySchema = z.object({
  rootNodeId: z.string().uuid(),
  limit: z.number().int().positive().optional(),
});

export type GetNodeSubtreeQuery = z.infer<typeof GetNodeSubtreeQuerySchema>;

export const ListChildrenQuerySchema = z.object({
  parentNodeId: z.string().uuid(),
  cursor: z.string().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export type ListChildrenQuery = z.infer<typeof ListChildrenQuerySchema>;
