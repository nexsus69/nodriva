import { z } from 'zod';

const relationshipSourceSchema = z.object({
  resourceId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
});

/** Validates a transactional link or unlink request from an inverse relation panel. */
export const MutateResourceRelationshipCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  actorSessionId: z.string().uuid(),
  sourceDomain: z.enum(['node', 'entity']),
  sourceTypeKey: z.string().min(1).max(100),
  sourceFieldKey: z.string().min(1).max(100),
  targetDomain: z.enum(['node', 'entity']),
  targetResourceId: z.string().uuid(),
  operation: z.enum(['link', 'unlink']),
  sources: z.array(relationshipSourceSchema).min(1).max(200),
}).superRefine((command, context) => {
  const ids = command.sources.map((source) => source.resourceId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sources'],
      message: 'A source resource can be submitted only once.',
    });
  }
});

export type MutateResourceRelationshipCommand = z.infer<typeof MutateResourceRelationshipCommandSchema>;
