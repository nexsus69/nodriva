import type { ClientNode } from '../../types/models';
import { useCachedNode } from '../../hooks/useCachedNode';
import { useSemanticNodeList } from '../../hooks/useSemanticNodeList';
import { resolveNodeTreeItemState } from './nodeTreeModel';
import { NodeTreeRow } from './NodeTreeRow';
import { Skeleton, SkeletonState } from '../ui/feedback';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

interface NodeTreeBranchProps {
  parentNode?: ClientNode;
  activeNodeId?: string;
  activeNodePath?: string;
  expandedNodeIds: ReadonlySet<string>;
  onToggle: (nodeId: string) => void;
}

export function NodeTreeBranch(props: NodeTreeBranchProps) {
  const { t } = useAppLocale();
  const parentId = props.parentNode?.id ?? null;
  const { nodes, isLoading, error, refresh } = useSemanticNodeList(parentId, {
    retentionClass: 'persistent',
  });
  const childIndent = props.parentNode
    ? `${(Math.max(props.parentNode.depth, 0) + 1) * 14 + 38}px`
    : undefined;

  if (isLoading) {
    return props.parentNode
      ? <SkeletonState label={t('nodeTree.loadingChildren')}><div className="space-y-3 py-2 pr-3" style={{ paddingLeft: childIndent }}><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-20" /></div></SkeletonState>
      : <NodeTreeSkeleton label={t('nodeTree.loadingRoots')} />;
  }

  if (error) {
    return props.parentNode ? (
      <div className="flex items-center gap-2 py-2 text-[11px] text-rose-300" style={{ paddingLeft: childIndent }}>
        <span>{t('nodeTree.branchError')}</span>
        <button type="button" onClick={refresh} className="font-semibold underline">{t('common.retry')}</button>
      </div>
    ) : (
      <div className="space-y-2 p-3 text-center">
        <p className="text-xs text-rose-300">{t('nodeTree.loadError')} {error.message}</p>
        <button type="button" onClick={refresh} className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20">{t('common.retry')}</button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return props.parentNode
      ? <div className="py-1.5 text-[10px] italic text-slate-600" style={{ paddingLeft: childIndent }}>{t('nodeTree.noChildren')}</div>
      : <TreeStatus>{t('nodeTree.noNodes')}</TreeStatus>;
  }

  return (
    <ul
      role={props.parentNode ? 'group' : 'tree'}
      aria-label={props.parentNode ? undefined : t('nodeTree.workspaceNodes')}
      className="space-y-0.5"
    >
      {nodes.map((node) => <NodeTreeItem key={node.id} node={node} {...props} />)}
    </ul>
  );
}

function NodeTreeSkeleton({ label }: { label: string }) {
  return <SkeletonState label={label} className="space-y-4 px-3 py-2">{[0, 1, 2, 3].map((row) => <div key={row} className="flex items-center gap-2"><Skeleton className="h-5 w-5 shrink-0 rounded" /><Skeleton className={`h-3 ${row % 2 === 0 ? 'w-32' : 'w-24'}`} /></div>)}</SkeletonState>;
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
