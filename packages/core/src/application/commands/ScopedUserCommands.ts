import { z } from 'zod';
import { UserPasswordSchema } from './UserAdminCommands.js';

export const CreateScopedUserCommandSchema = z.object({
  email: z.string().email(),
  password: UserPasswordSchema,
  actorUserId: z.string().uuid(),
  assignments: z.array(z.object({
    nodeId: z.string().uuid(),
    roleId: z.string().uuid(),
    propagation: z.enum(['self', 'subtree']),
  })).min(1),
});

export type CreateScopedUserCommand = z.infer<typeof CreateScopedUserCommandSchema>;
