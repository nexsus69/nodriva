import type { ClientNode } from '../../types/models';
import { useCachedNode } from '../../hooks/useCachedNode';
import { useSemanticNodeList } from '../../hooks/useSemanticNodeList';
import { resolveNodeTreeItemState } from './nodeTreeModel';
import { NodeTreeRow } from './NodeTreeRow';

interface NodeTreeBranchProps {
  parentNode?: ClientNode;
  activeNodeId?: string;
  activeNodePath?: string;
  expandedNodeIds: ReadonlySet<string>;
  onToggle: (nodeId: string) => void;
}

export function NodeTreeBranch(props: NodeTreeBranchProps) {
  const parentId = props.parentNode?.id ?? null;
  const { nodes, isLoading, error, refresh } = useSemanticNodeList(parentId, {
    retentionClass: 'persistent',
  });
  const childIndent = props.parentNode
    ? `${(Math.max(props.parentNode.depth, 0) + 1) * 14 + 38}px`
    : undefined;

  if (isLoading) {
    return props.parentNode
      ? <div role="status" className="py-2 text-[11px] text-slate-500" style={{ paddingLeft: childIndent }}>Caricamento…</div>
      : <TreeStatus>Caricamento nodi radice…</TreeStatus>;
  }

  if (error) {
    return props.parentNode ? (
      <div className="flex items-center gap-2 py-2 text-[11px] text-rose-300" style={{ paddingLeft: childIndent }}>
        <span>Errore nel ramo.</span>
        <button type="button" onClick={refresh} className="font-semibold underline">Riprova</button>
      </div>
    ) : (
      <div className="space-y-2 p-3 text-center">
        <p className="text-xs text-rose-300">Impossibile caricare l&apos;albero: {error.message}</p>
        <button type="button" onClick={refresh} className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20">Riprova</button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return props.parentNode
      ? <div className="py-1.5 text-[10px] italic text-slate-600" style={{ paddingLeft: childIndent }}>Nessun figlio</div>
      : <TreeStatus>Nessun nodo disponibile.</TreeStatus>;
  }

  return (
    <ul
      role={props.parentNode ? 'group' : 'tree'}
      aria-label={props.parentNode ? undefined : 'Nodi workspace'}
      className="space-y-0.5"
    >
      {nodes.map((node) => <NodeTreeItem key={node.id} node={node} {...props} />)}
    </ul>
  );
}

function NodeTreeItem({ node, ...props }: NodeTreeBranchProps & { node: ClientNode }) {
  const currentNode = useCachedNode(node.id) ?? node;
  const state = resolveNodeTreeItemState(
    currentNode,
    props.expandedNodeIds,
    props.activeNodeId,
    props.activeNodePath,
  );

  return (
    <li role="treeitem" aria-selected={state.isActive} aria-expanded={state.isExpanded} className="text-xs">
      <NodeTreeRow node={currentNode} state={state} onToggle={props.onToggle} />
      {state.isExpanded && <NodeTreeBranch {...props} parentNode={currentNode} />}
    </li>
  );
}

function TreeStatus({ children }: { children: React.ReactNode }) {
  return <div role="status" className="p-5 text-center text-xs text-slate-500">{children}</div>;
}
