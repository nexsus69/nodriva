'use client';

/** Keeps entity detail navigation in Admin while reusing its canonical controller. */
import { EntityDetailScreen } from '@/app/nodes/[nodeId]/entities/[entityId]/_components/EntityDetailScreen';

export function AdminEntityDetailScreen({ parentNodeId, entityId }: { parentNodeId: string; entityId: string }) {
  return <EntityDetailScreen admin nodeId={parentNodeId} entityId={entityId} />;
}
