import Link from '@/app/components/navigation/GuardedLink';
import type { KeyboardEvent } from 'react';
import type { ClientNode } from '../../types/models';
import { LockIndicator } from '../LockIndicator';
import { NodeResourceMenu } from '../ui/menu';
import type { NodeTreeItemState } from './nodeTreeModel';

interface NodeTreeRowProps {
  node: ClientNode;
  state: NodeTreeItemState;
  onToggle: (nodeId: string) => void;
}

export function NodeTreeRow({ node, state, onToggle }: NodeTreeRowProps) {
  const handleToggleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' && !state.isExpanded) {
      event.preventDefault();
      onToggle(node.id);
    } else if (event.key === 'ArrowLeft' && state.isExpanded && !state.isActiveAncestor) {
      event.preventDefault();
      onToggle(node.id);
    }
  };

  return (
    <div
      className={`group flex min-h-8 items-center rounded-lg transition-colors ${
        state.isActive
          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
      style={{ paddingLeft: `${Math.max(node.depth, 0) * 14 + 4}px` }}
    >
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        onKeyDown={handleToggleKeyDown}
        disabled={state.isActiveAncestor}
        aria-label={state.isActiveAncestor
          ? `${node.name}, antenato del nodo corrente`
          : `${state.isExpanded ? 'Comprimi' : 'Espandi'} ${node.name}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span aria-hidden="true" className={`transition-transform ${state.isExpanded ? 'rotate-90' : ''}`}>›</span>
      </button>
      <span aria-hidden="true" className="mr-1.5 text-sm">{state.isExpanded ? '📂' : '📁'}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Link
          href={`/nodes/${node.id}`}
          aria-current={state.isActive ? 'page' : undefined}
          title={node.description || node.name}
          className="min-w-0 truncate py-2 pr-0 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
        >
          {node.name}
        </Link>
        <NodeResourceMenu nodeId={node.id} nodeName={node.name} />
      </div>
      <LockIndicator resourceType="node" resourceId={node.id} />
    </div>
  );
}
