/** Coordinates preview and atomic commit for inverse relationship mutations. */

import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { MutateResourceRelationshipCommand } from '../commands/ResourceRelationshipCommands.js';
import { MutateResourceRelationshipCommandSchema } from '../commands/ResourceRelationshipCommands.js';
import type { RelationshipMutationPlan } from '../dto/RelationshipMutationPlan.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { EntityTypeRepository } from '../ports/EntityTypeRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { ResourceRelationshipRepository } from '../ports/ResourceRelationshipRepository.js';
import type { RevisionPort } from '../ports/RevisionPort.js';
import type { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { TypeDefinitionReader } from '../ports/TypeDefinitionReader.js';
import { BatchMutationConcurrencyGuard } from './BatchMutationConcurrencyGuard.js';
import { RelationshipMutationCommitter, type RelationshipMutationResult } from './RelationshipMutationCommitter.js';
import { RelationshipMutationPlanner } from './RelationshipMutationPlanner.js';
import type { LockService } from './LockService.js';
import { ResourceRelationshipMutationWriter, type RelationshipMutationResource } from './ResourceRelationshipMutationWriter.js';
import type { ResourceRelationshipService } from './ResourceRelationshipService.js';

export type { RelationshipMutationResource, RelationshipMutationResult };

/**
 * Facade for inverse relationship batch mutations.
 *
 * It offers a read-only preview and a separately committed mutation. The
 * latter rebuilds the plan inside one transaction, checks current locks and
 * row versions, and then delegates all lifecycle writes to focused objects.
 */
export class ResourceRelationshipMutationService {
  private readonly planner: RelationshipMutationPlanner;
  private readonly concurrencyGuard: BatchMutationConcurrencyGuard;
  private readonly committer: RelationshipMutationCommitter;

  constructor(
    relationshipRepository: ResourceRelationshipRepository,
    relationshipService: ResourceRelationshipService,
    typeDefinitionReader: TypeDefinitionReader,
    nodeRepository: NodeRepository,
    entityRepository: EntityRepository,
    nodeTypeRepository: NodeTypeRepository,
    entityTypeRepository: EntityTypeRepository,
    accessControlPort: AccessControlPort,
    lockService: LockService,
    auditPort: AuditPort,
    revisionPort: RevisionPort,
    runtimeConfigPort: RuntimeConfigurationPort,
    private readonly transactionPort: TransactionPort,
  ) {
    this.planner = new RelationshipMutationPlanner(
      relationshipRepository,
      relationshipService,
      typeDefinitionReader,
      nodeRepository,
      entityRepository,
      nodeTypeRepository,
      entityTypeRepository,
      accessControlPort,
    );
    this.concurrencyGuard = new BatchMutationConcurrencyGuard(lockService, runtimeConfigPort);
    this.committer = new RelationshipMutationCommitter(
      relationshipRepository,
      new ResourceRelationshipMutationWriter(
        relationshipService,
        nodeRepository,
        entityRepository,
        auditPort,
        revisionPort,
      ),
    );
  }

  /** Returns the canonical impact preview without reserving or changing resources. */
  async prepare(command: MutateResourceRelationshipCommand): Promise<RelationshipMutationPlan> {
    const validated = parseCommand(command);
    const plan = await this.planner.prepare(validated);
    const lockStates = await this.concurrencyGuard.inspect(
      plan.items.map((item) => ({ domain: validated.sourceDomain, resourceId: item.resourceId })),
      validated.actorUserId,
      validated.actorSessionId,
    );
    return {
      ...plan,
      unavailableSourceIds: lockStates
        .filter((state) => !state.available)
        .map((state) => state.resourceId),
    };
  }

  /** Applies the command atomically after rebuilding its authoritative plan. */
  async mutate(command: MutateResourceRelationshipCommand): Promise<RelationshipMutationResult> {
    const validated = parseCommand(command);
    return this.transactionPort.runInTransaction(async () => {
      const plan = await this.planner.prepare(validated);
      await this.concurrencyGuard.assertAvailable(
        plan.items.map((item) => ({ domain: validated.sourceDomain, resourceId: item.resourceId })),
        validated.actorUserId,
        validated.actorSessionId,
      );
      return this.committer.commit(plan, {
        acceptedReplacementSourceIds: validated.acceptedReplacementSourceIds ?? [],
      });
    });
  }
}

function parseCommand(command: MutateResourceRelationshipCommand): MutateResourceRelationshipCommand {
  const result = MutateResourceRelationshipCommandSchema.safeParse(command);
  if (result.success) return result.data;
  const issues: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'root';
    (issues[path] ??= []).push(issue.message);
  }
  throw new ValidationError('Relationship mutation validation failed.', issues);
}
