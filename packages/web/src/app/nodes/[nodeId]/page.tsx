'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert } from '../../components/ui/feedback';
import { PageShell, Panel } from '../../components/ui/layout';
import { ChildNodesSection } from './_components/ChildNodesSection';
import { NodeContextOverview } from './_components/NodeContextOverview';
import { NodeEditorPanel } from './_components/NodeEditorPanel';
import { NodeEntitiesSection } from './_components/NodeEntitiesSection';
import { NodeWorkspaceNavigation } from './_components/NodeWorkspaceNavigation';
import { SubtreeEntitiesTableSection } from './_components/SubtreeEntitiesTableSection';
import { useNodeDetail } from './_hooks/useNodeDetail';

function AccessDenied() {
  return (
    <PageShell>
      <Panel className="mx-auto max-w-xl space-y-4 border-rose-200 bg-rose-50">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-semibold text-slate-900">Accesso al nodo negato</h1>
        <p className="text-sm text-slate-600">Non disponi di uno scope di lettura per questa area.</p>
        <Link href="/" className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500">Torna al workspace</Link>
      </Panel>
    </PageShell>
  );
}

export default function NodeDetailPage() {
  const params = useParams();
  const nodeId = params.nodeId as string;
  const controller = useNodeDetail(nodeId);

  if (controller.nodeAccessDenied || controller.nodeAccess === 'denied') return <AccessDenied />;
  if (controller.nodeAccess === 'checking') {
    return <PageShell><Panel className="mx-auto max-w-xl"><p className="text-sm text-slate-500">Verifica autorizzazioni del nodo…</p></Panel></PageShell>;
  }

  return (
    <PageShell>
      <NodeWorkspaceNavigation nodeId={nodeId} readOnly={controller.readOnly} />
      <NodeContextOverview nodeId={nodeId} controller={controller} />
      {controller.displayedError && <Alert tone="danger"><span className="font-bold">Errore:</span> {controller.displayedError}</Alert>}
      {controller.successMessage && <Alert tone="success"><span className="font-bold">Esito:</span> {controller.successMessage}</Alert>}
      <NodeEditorPanel nodeId={nodeId} controller={controller} />
      <NodeEntitiesSection nodeId={nodeId} controller={controller} />
      <ChildNodesSection nodeId={nodeId} childNodes={controller.childNodes} readOnly={controller.readOnly} />
      <SubtreeEntitiesTableSection nodeId={nodeId} />
    </PageShell>
  );
}
