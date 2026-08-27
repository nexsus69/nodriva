/** Verifies the stable technical-key rule for newly created roles. */
import { describe, expect, it } from 'vitest';
import { CreateRoleCommandSchema } from './SecurityAdminCommands.js';

const command = {
  name: 'Operatore progetti',
  actorUserId: '00000000-0000-4000-8000-000000000001',
};

describe('CreateRoleCommandSchema', () => {
  it('accepts lowercase snake_case role keys and rejects ambiguous alternatives', () => {
    expect(CreateRoleCommandSchema.safeParse({ ...command, roleKey: 'project_operator' }).success).toBe(true);
    expect(CreateRoleCommandSchema.safeParse({ ...command, roleKey: 'project-operator' }).success).toBe(false);
    expect(CreateRoleCommandSchema.safeParse({ ...command, roleKey: 'project operator' }).success).toBe(false);
    expect(CreateRoleCommandSchema.safeParse({ ...command, roleKey: '1_project_operator' }).success).toBe(false);
  });
});
