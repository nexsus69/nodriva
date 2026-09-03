import { describe, expect, it } from 'vitest';
import type { ResourceRelationshipRepository } from '../application/ports/ResourceRelationshipRepository.js';

/** Shared observable contract for SQLite and PostgreSQL relationship adapters. */
export function resourceRelationshipRepositoryContract(
  label: string,
  createRepository: () => Promise<ResourceRelationshipRepository>,
): void {
  describe(`${label} resource relationship repository`, () => {
    it('replaces one ordered source-field value and exposes it from both sides', async () => {
      const repository = await createRepository();
      await repository.replaceValues({
        sourceFieldId: '11111111-1111-4111-8111-111111111111',
        sourceDomain: 'entity',
        sourceResourceId: '22222222-2222-4222-8222-222222222222',
        targetDomain: 'entity',
        targetResourceIds: ['33333333-3333-4333-8333-333333333333'],
        sourceCardinality: 'one',
        targetIsUnique: false,
      });

      await expect(repository.listOutgoing('entity', '22222222-2222-4222-8222-222222222222')).resolves.toEqual([
        expect.objectContaining({
          sourceFieldId: '11111111-1111-4111-8111-111111111111',
          targetResourceId: '33333333-3333-4333-8333-333333333333',
          position: 0,
        }),
      ]);
      await expect(repository.listIncoming('entity', '33333333-3333-4333-8333-333333333333')).resolves.toHaveLength(1);
    });

    it('replaces stale values rather than accumulating duplicate edges', async () => {
      const repository = await createRepository();
      const source = {
        sourceFieldId: '11111111-1111-4111-8111-111111111111',
        sourceDomain: 'entity' as const,
        sourceResourceId: '22222222-2222-4222-8222-222222222222',
        targetDomain: 'entity' as const,
        sourceCardinality: 'many' as const,
        targetIsUnique: false,
      };
      await repository.replaceValues({ ...source, targetResourceIds: [
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
      ] });
      await repository.replaceValues({ ...source, targetResourceIds: ['55555555-5555-4555-8555-555555555555'] });

      await expect(repository.listOutgoing(source.sourceDomain, source.sourceResourceId)).resolves.toEqual([
        expect.objectContaining({ targetResourceId: '55555555-5555-4555-8555-555555555555', position: 0 }),
      ]);
    });

    it('rejects more than one value for a single-valued source field', async () => {
      const repository = await createRepository();
      await expect(repository.replaceValues({
        sourceFieldId: '11111111-1111-4111-8111-111111111111',
        sourceDomain: 'entity',
        sourceResourceId: '22222222-2222-4222-8222-222222222222',
        targetDomain: 'entity',
        targetResourceIds: [
          '33333333-3333-4333-8333-333333333333',
          '44444444-4444-4444-8444-444444444444',
        ],
        sourceCardinality: 'one',
        targetIsUnique: false,
      })).rejects.toThrow('single-valued relationship');
    });

    it('suspends outgoing edges and restores them without changing the full-history read', async () => {
      const repository = await createRepository();
      const source = { domain: 'entity' as const, resourceId: '22222222-2222-4222-8222-222222222222' };
      await repository.replaceValues({
        sourceFieldId: '11111111-1111-4111-8111-111111111111', sourceDomain: source.domain, sourceResourceId: source.resourceId,
        targetDomain: 'entity', targetResourceIds: ['33333333-3333-4333-8333-333333333333'], sourceCardinality: 'one', targetIsUnique: false,
      });
      await repository.suspendActiveOutgoingForSources([source], '00000000-0000-0000-0000-000000000001');
      await expect(repository.listActiveOutgoing(source.domain, source.resourceId)).resolves.toEqual([]);
      await expect(repository.listOutgoing(source.domain, source.resourceId)).resolves.toHaveLength(1);
      await repository.restoreSuspendedOutgoingForSources([source], '00000000-0000-0000-0000-000000000001');
      await expect(repository.listActiveOutgoing(source.domain, source.resourceId)).resolves.toHaveLength(1);
    });

    it('does not reactivate an edge suspended by a different deletion batch', async () => {
      const repository = await createRepository();
      const source = { domain: 'entity' as const, resourceId: '22222222-2222-4222-8222-222222222222' };
      await repository.replaceValues({ sourceFieldId: '11111111-1111-4111-8111-111111111111', sourceDomain: source.domain, sourceResourceId: source.resourceId, targetDomain: 'entity', targetResourceIds: ['33333333-3333-4333-8333-333333333333'], sourceCardinality: 'one', targetIsUnique: false });
      await repository.suspendActiveOutgoingForSources([source], '00000000-0000-0000-0000-000000000010');
      await repository.restoreSuspendedOutgoingForSources([source], '00000000-0000-0000-0000-000000000011');
      await expect(repository.listActiveOutgoing(source.domain, source.resourceId)).resolves.toEqual([]);
    });
  });
}
