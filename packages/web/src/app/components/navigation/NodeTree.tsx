'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { NodeTreeBranch } from './NodeTreeBranch';
import { useNodeTreeController } from './useNodeTreeController';

export interface NodeTreeProps {
  activeNodeId?: string;
  activeNodePath?: string;
  className?: string;
}

export function NodeTree({ activeNodeId, activeNodePath, className = '' }: NodeTreeProps) {
  const controller = useNodeTreeController();

  return (
    <nav
      aria-label="Navigazione albero nodi"
      className={`glass-panel overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Albero dei nodi</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Espandi un ramo o seleziona un nodo</p>
        </div>
        <Link
          href="/"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
        >
          Radice
        </Link>
      </div>

      <div className="max-h-80 overflow-auto p-2">
        <NodeTreeBranch
          activeNodeId={activeNodeId}
          activeNodePath={activeNodePath}
          expandedNodeIds={controller.expandedNodeIds}
          onToggle={controller.toggleNode}
        />
      </div>
    </nav>
  );
}
