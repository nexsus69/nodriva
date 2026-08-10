import type { PgExecutor } from '@dashboard/core';

export async function resolveAttachmentEncryption(
  executor: PgExecutor,
  nodeTypeId: string,
  globalEnabled: boolean,
): Promise<boolean> {
  const result = await executor.query<{ encryption_mode: 'inherit' | 'enabled' | 'disabled' }>(
    'SELECT encryption_mode FROM node_type_attachment_policies WHERE node_type_id = $1',
    [nodeTypeId],
  );
  const mode = result.rows[0]?.encryption_mode ?? 'inherit';
  return mode === 'enabled' || (mode === 'inherit' && globalEnabled);
}
