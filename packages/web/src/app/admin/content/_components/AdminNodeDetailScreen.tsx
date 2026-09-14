'use client';

/** Composes a node detail inside Admin while reusing the canonical edit owner. */
import Link from '@/app/components/navigation/GuardedLink';
import { Alert, ResourceDeleteRestriction } from '@/app/components/ui/feedback';
import { PageShell, Panel } from '@/app/components/ui/layout';
import { RelationPanel } from '@/app/components/ui/relations';
import { LockIndicator } from '@/app/components/LockIndicator';
import { NodeAccessUnavailable } from '@/app/nodes/[nodeId]/_components/NodeAccessUnavailable';
import { NodeEditorPanel } from '@/app/nodes/[nodeId]/_components/NodeEditorPanel';
import { useNodeDetail } from '@/app/nodes/[nodeId]/_hooks/useNodeDetail';

export function AdminNodeDetailScreen({ nodeId }: { nodeId: string }) {
  const controller = useNodeDetail(nodeId, {
    afterDelete: '/admin/content/nodes',
    detailPath: `/admin/content/nodes/${nodeId}`,
  });
  if (controller.nodeAccessDenied || controller.nodeAccess === 'denied') {
    return <PageShell><Panel className="mx-auto max-w-xl space-y-4 border-rose-200 bg-rose-50"><h1 className="text-xl font-semibold text-slate-900">Accesso al nodo negato</h1><Link href="/admin/content/nodes" className="text-sm font-semibold text-indigo-700">Torna ai nodi</Link></Panel></PageShell>;
  }
  if (controller.nodeAccess === 'unavailable') return <NodeAccessUnavailable onRetry={controller.retryNodeAccess} />;
  return (
    <PageShell>
      <div aria-label="Percorso dettaglio amministrativo" className="flex min-w-0 items-center gap-1 border-b border-slate-200 pb-4">
        <Link href="/admin/content/nodes" className="text-xs font-semibold text-indigo-700">← Nodi</Link>
        <span className="text-slate-400">/</span>
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-mono font-semibold text-slate-800">
          <span className="truncate">{controller.currentNode?.name ?? 'Dettaglio amministrativo'}</span>
          {controller.currentNode && <LockIndicator resourceType="node" resourceId={controller.currentNode.id} />}
        </span>
      </div>
      {controller.displayedError && <Alert tone="danger"><strong>Errore:</strong> {controller.displayedError}{controller.deleteRestriction && <ResourceDeleteRestriction restriction={controller.deleteRestriction} />}</Alert>}
      {controller.successMessage && <Alert tone="success">{controller.successMessage}</Alert>}
      <NodeEditorPanel nodeId={nodeId} controller={controller} />
      {controller.currentNode && controller.nodeTypes[controller.currentNode.nodeTypeId]?.typeKey && <RelationPanel resourceDomain="node" resourceTypeKey={controller.nodeTypes[controller.currentNode.nodeTypeId].typeKey} resourceId={nodeId} />}
    </PageShell>
  );
}
