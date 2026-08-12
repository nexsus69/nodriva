import type { ConfigService, EntityRepository, NodeRepository, PgExecutor, ResourceSecurityPolicy, ResourceSecurityPolicyResolver } from '@dashboard/core';

export class PostgresResourceSecurityPolicyResolver implements ResourceSecurityPolicyResolver {
  constructor(
    private readonly executor: PgExecutor,
    private readonly configService: ConfigService,
    private readonly nodeRepository: NodeRepository,
    private readonly entityRepository: EntityRepository,
    private readonly requireScan = false,
  ) {}

  async resolve(resourceType: 'node' | 'entity', resourceId: string): Promise<ResourceSecurityPolicy> {
    const nodeTypeId = await this.resolveNodeTypeId(resourceType, resourceId);
    const [encryptionGlobal, antivirusGlobal, nodePolicy] = await Promise.all([
      this.configService.get<boolean>('attachments.encryptionEnabled'),
      this.configService.get<boolean>('attachments.antivirusEnabled'),
      this.executor.query<{ encryption_mode: 'enabled' | 'disabled' }>(
        'SELECT encryption_mode FROM node_type_attachment_policies WHERE node_type_id = $1', [nodeTypeId],
      ),
    ]);
    const mode = nodePolicy.rows[0]?.encryption_mode ?? 'disabled';
    return {
      encryptionEnabled: encryptionGlobal && mode === 'enabled',
      antivirusEnabled: antivirusGlobal || this.requireScan,
    };
  }

  private async resolveNodeTypeId(resourceType: 'node' | 'entity', resourceId: string): Promise<string> {
    const node = resourceType === 'node'
      ? await this.nodeRepository.findById(resourceId)
      : await this.resolveEntityParentNode(resourceId);
    if (!node) throw new Error('Resource security scope not found');
    return node.nodeTypeId;
  }

  private async resolveEntityParentNode(entityId: string) {
    const entity = await this.entityRepository.findById(entityId);
    return entity ? await this.nodeRepository.findById(entity.parentNodeId) : null;
  }
}
