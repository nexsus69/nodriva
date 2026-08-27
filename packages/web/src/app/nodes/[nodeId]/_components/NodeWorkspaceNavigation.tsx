'use client';

/** Presents creation navigation independently from the lock state of the current node. */
import Link from '@/app/components/navigation/GuardedLink';
import { NodeBreadcrumb } from '../../../components/navigation/NodeBreadcrumb';
import { useCreationHref } from '../../../navigation/returnContext';

interface NodeWorkspaceNavigationProps { nodeId: string; canCreate: boolean }

export function NodeWorkspaceNavigation({ nodeId, canCreate }: NodeWorkspaceNavigationProps) {
  const createChildHref = useCreationHref(`/nodes/${nodeId}/new`);
  const createEntityHref = useCreationHref(`/nodes/${nodeId}/entities/new`);
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <NodeBreadcrumb nodeId={nodeId} />
      {canCreate && (
        <div className="flex items-center gap-2">
          <Link href={createChildHref} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"><span>➕</span> Sotto-Nodo</Link>
          <Link href={createEntityHref} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500"><span>➕</span> Nuova Entità</Link>
        </div>
      )}
    </div>
  );
}
