/** Verifies atomic, coverage-bound provisioning of scoped users. */
import { describe, expect, it, vi } from 'vitest';
import { ScopedUserProvisioningService } from './ScopedUserProvisioningService.js';
import { Role } from '../../domain/models/Role.js';

const ACTOR = '00000000-0000-0000-0000-000000000001';
const NODE = '00000000-0000-0000-0000-000000000002';
const ROLE = '00000000-0000-0000-0000-000000000003';

function setup() {
  const users = { findByEmail: vi.fn().mockResolvedValue(null), createUser: vi.fn().mockResolvedValue(undefined), listAllRoles: vi.fn().mockResolvedValue([{ id: 'baseline', roleKey: 'default_reader', name: 'Default Reader' }]) };
  const security = {
    findRoleById: vi.fn().mockResolvedValue(Role.create(ROLE, 'local_admin', 'Local admin')),
    listRolePermissionKeys: vi.fn().mockResolvedValue(['entity.read']),
    createScopeAssignment: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const transactions = {
    runInTransaction: vi.fn().mockImplementation(async (work) => work()),
    runInAuthorizationMutation: vi.fn().mockImplementation(async (work) => work()),
  };
  const ids = { generate: vi.fn().mockReturnValueOnce('00000000-0000-0000-0000-000000000010').mockReturnValue('00000000-0000-0000-0000-000000000011') };
  const access = {
    assertHasPermissionCoverage: vi.fn().mockResolvedValue(undefined),
    assertHasPermissionCoverageBatch: vi.fn().mockResolvedValue(undefined),
  };
  return { users, security, audit, transactions, ids, access, service: new ScopedUserProvisioningService(users as never, security as never, audit as never, transactions as never, ids, access as never) };
}

describe('ScopedUserProvisioningService', () => {
  it('creates the user and local scope grant in one transaction', async () => {
    const { service, users, security, transactions } = setup();
    await service.createScopedUser({ email: 'local@example.com', password: 'StrongPassword!123', actorUserId: ACTOR, assignments: [{ nodeId: NODE, roleId: ROLE, propagation: 'subtree' }] });
    expect(transactions.runInAuthorizationMutation).toHaveBeenCalledOnce();
    expect(users.createUser).toHaveBeenCalledWith(expect.anything(), ['baseline']);
    expect(security.createScopeAssignment).toHaveBeenCalledWith(expect.any(String), expect.any(String), NODE, ROLE, 'allow', 'subtree', ACTOR);
  });

  it('does not create anything when delegated coverage is denied', async () => {
    const { service, users, security, access } = setup();
    access.assertHasPermissionCoverageBatch.mockRejectedValueOnce(new Error('Denied'));
    await expect(service.createScopedUser({ email: 'local@example.com', password: 'StrongPassword!123', actorUserId: ACTOR, assignments: [{ nodeId: NODE, roleId: ROLE, propagation: 'subtree' }] })).rejects.toThrow('Denied');
    expect(users.createUser).not.toHaveBeenCalled();
    expect(security.createScopeAssignment).not.toHaveBeenCalled();
  });
});
