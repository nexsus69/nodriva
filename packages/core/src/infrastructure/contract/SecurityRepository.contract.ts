import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SecurityRepository } from '../../application/ports/SecurityRepository.js';
import { SecurityAdminValidationError } from '../../domain/errors/SecurityAdminErrors.js';

export interface SecurityRepositoryContractFixture {
  readonly repository: SecurityRepository;
  readonly ids: { readonly delegator: string; readonly intermediate: string; readonly target: string; readonly root: string; readonly reader: string; readonly firstDelegation: string; readonly secondDelegation: string; readonly contradictoryDeny: string };
  removeDelegatorCoverage(): Promise<void>;
  hasAssignment(id: string): Promise<boolean>;
  dispose(): Promise<void>;
}

/** Verifies delegation invariants through the public security repository port. */
export function registerSecurityRepositoryContract(
  adapterName: string,
  createFixture: () => Promise<SecurityRepositoryContractFixture>,
): void {
  describe(`${adapterName} SecurityRepository contract`, () => {
    let fixture: SecurityRepositoryContractFixture;

    beforeEach(async () => { fixture = await createFixture(); });
    afterEach(async () => { if (fixture) await fixture.dispose(); });

    it('rejects contradictory deny assignments and revokes uncovered delegations transitively', async () => {
      const { ids } = fixture;
      await fixture.repository.createScopeAssignment(ids.firstDelegation, ids.intermediate, ids.root, ids.reader, 'allow', 'subtree', ids.delegator);
      await fixture.repository.createScopeAssignment(ids.secondDelegation, ids.target, ids.root, ids.reader, 'allow', 'self', ids.intermediate);

      await expect(fixture.repository.createScopeAssignment(
        ids.contradictoryDeny, ids.target, ids.root, ids.reader, 'deny', 'self', ids.intermediate,
      )).rejects.toBeInstanceOf(SecurityAdminValidationError);

      await fixture.removeDelegatorCoverage();
      const revoked = await fixture.repository.revokeDelegatedScopeAssignmentsOutsideCoverage();
      expect(revoked.map((assignment) => assignment.id).sort()).toEqual([ids.firstDelegation, ids.secondDelegation].sort());
      await expect(fixture.hasAssignment(ids.firstDelegation)).resolves.toBe(false);
      await expect(fixture.hasAssignment(ids.secondDelegation)).resolves.toBe(false);
    });
  });
}
