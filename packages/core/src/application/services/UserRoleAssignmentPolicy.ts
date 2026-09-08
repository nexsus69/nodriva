import type { UserRepository } from '../ports/UserRepository.js';

export const REQUIRED_BASELINE_ROLE_KEY = 'default_reader';

/** Application-owned normalization for the roles persisted on every identity. */
export async function withRequiredBaselineRole(
  users: Pick<UserRepository, 'listAllRoles'>,
  requestedRoleIds: readonly string[],
): Promise<string[]> {
  const baseline = (await users.listAllRoles()).find((role) => role.roleKey === REQUIRED_BASELINE_ROLE_KEY);
  if (!baseline) throw new Error(`Required system role '${REQUIRED_BASELINE_ROLE_KEY}' is missing.`);
  return [...new Set([baseline.id, ...requestedRoleIds])];
}
