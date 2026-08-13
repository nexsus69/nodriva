import Link from 'next/link';
import { Panel, SectionHeader } from '../../../components/ui/layout';
import { NodeEntityGrid } from './NodeEntityGrid';
import type { useNodeDetail } from '../_hooks/useNodeDetail';

interface NodeEntitiesSectionProps { nodeId: string; controller: ReturnType<typeof useNodeDetail> }

export function NodeEntitiesSection({ nodeId, controller }: NodeEntitiesSectionProps) {
  return (
    <Panel className="space-y-4">
      <SectionHeader
        title={`Entità del nodo (${controller.nodeEntities.length})`}
        description="Le entità vengono visualizzate in base ai metadata del loro tipo."
        actions={!controller.readOnly ? <Link href={`/nodes/${nodeId}/entities/new`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">+ Nuova entità</Link> : undefined}
      />
      {controller.isEntitiesLoading ? <p className="p-6 text-center text-xs text-slate-500">Caricamento entità…</p>
        : controller.nodeEntities.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">Nessuna entità associata a questo nodo.</p>
          : <NodeEntityGrid nodeId={nodeId} entities={controller.nodeEntities} entityTypes={controller.entityTypes} entityDefinitions={controller.entityDefinitions} />}
    </Panel>
  );
}
