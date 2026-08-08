'use client';

import Link from 'next/link';
import { KeyboardEvent, useState } from 'react';
import { useSemanticNodeList } from '../../hooks/useSemanticNodeList';
import type { ClientNode } from '../../types/models';
import { isNodeAncestorOfPath } from './nodeTreePath';
import { useCachedNode } from '../../hooks/useCachedNode';
import { LockIndicator } from '../LockIndicator';
import { NodeResourceMenu } from '../ui/menu';

export interface NodeTreeProps {
  activeNodeId?: string;
  activeNodePath?: string;
  className?: string;
}

interface NodeTreeItemProps {
  node: ClientNode;
  activeNodeId?: string;
  activeNodePath?: string;
  expandedNodeIds: ReadonlySet<string>;
  onToggle: (nodeId: string) => void;
}

export function NodeTree({
  activeNodeId,
  activeNodePath,
  className = '',
}: NodeTreeProps) {
  const { nodes, isLoading, error, refresh } = useSemanticNodeList(null, {
    retentionClass: 'persistent',
  });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set()
  );

  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <nav
      aria-label="Navigazione albero nodi"
      className={`glass-panel overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Albero dei nodi
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Espandi un ramo o seleziona un nodo
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
        >
          Radice
        </Link>
      </div>

      <div className="max-h-80 overflow-auto p-2">
        {isLoading ? (
          <TreeStatus>Caricamento nodi radice…</TreeStatus>
        ) : error ? (
          <div className="space-y-2 p-3 text-center">
            <p className="text-xs text-rose-300">
              Impossibile caricare l&apos;albero: {error.message}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
            >
              Riprova
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <TreeStatus>Nessun nodo disponibile.</TreeStatus>
        ) : (
          <ul role="tree" aria-label="Nodi workspace" className="space-y-0.5">
            {nodes.map((node) => (
              <NodeTreeItem
                key={node.id}
                node={node}
                activeNodeId={activeNodeId}
                activeNodePath={activeNodePath}
                expandedNodeIds={expandedNodeIds}
                onToggle={toggleNode}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

function NodeTreeItem({
  node,
  activeNodeId,
  activeNodePath,
  expandedNodeIds,
  onToggle,
}: NodeTreeItemProps) {
  const cachedNode = useCachedNode(node.id);
  const currentNode = cachedNode ?? node;
  const isActive = currentNode.id === activeNodeId;
  const isActiveAncestor = isNodeAncestorOfPath(currentNode.path, activeNodePath);
  const isExpanded = expandedNodeIds.has(currentNode.id) || isActiveAncestor;

  const handleToggleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' && !isExpanded) {
      event.preventDefault();
      onToggle(currentNode.id);
    } else if (event.key === 'ArrowLeft' && isExpanded && !isActiveAncestor) {
      event.preventDefault();
      onToggle(currentNode.id);
    }
  };

  return (
    <li
      role="treeitem"
      aria-selected={isActive}
      aria-expanded={isExpanded}
      className="text-xs"
    >
      <div
        className={`group flex min-h-8 items-center rounded-lg transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
        style={{ paddingLeft: `${Math.max(currentNode.depth, 0) * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(currentNode.id)}
          onKeyDown={handleToggleKeyDown}
          disabled={isActiveAncestor}
          aria-label={
            isActiveAncestor
              ? `${currentNode.name}, antenato del nodo corrente`
              : `${isExpanded ? 'Comprimi' : 'Espandi'} ${currentNode.name}`
          }
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span
            aria-hidden="true"
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            ›
          </span>
        </button>
        <span aria-hidden="true" className="mr-1.5 text-sm">
          {isExpanded ? '📂' : '📁'}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Link
            href={`/nodes/${currentNode.id}`}
            aria-current={isActive ? 'page' : undefined}
            title={currentNode.description || currentNode.name}
            className="min-w-0 truncate py-2 pr-0 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
          >
            {currentNode.name}
          </Link>
          <NodeResourceMenu nodeId={currentNode.id} nodeName={currentNode.name} />
        </div>
        <LockIndicator resourceType="node" resourceId={currentNode.id} />
      </div>

      {isExpanded && (
        <NodeTreeChildren
          parentNode={currentNode}
          activeNodeId={activeNodeId}
          activeNodePath={activeNodePath}
          expandedNodeIds={expandedNodeIds}
          onToggle={onToggle}
        />
      )}
    </li>
  );
}

function NodeTreeChildren({
  parentNode,
  activeNodeId,
  activeNodePath,
  expandedNodeIds,
  onToggle,
}: {
  parentNode: ClientNode;
  activeNodeId?: string;
  activeNodePath?: string;
  expandedNodeIds: ReadonlySet<string>;
  onToggle: (nodeId: string) => void;
}) {
  const { nodes, isLoading, error, refresh } = useSemanticNodeList(parentNode.id, {
    retentionClass: 'persistent',
  });
  const childIndent = `${(Math.max(parentNode.depth, 0) + 1) * 14 + 38}px`;

  if (isLoading) {
    return (
      <div role="status" className="py-2 text-[11px] text-slate-500" style={{ paddingLeft: childIndent }}>
        Caricamento…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-2 text-[11px] text-rose-300" style={{ paddingLeft: childIndent }}>
        <span>Errore nel ramo.</span>
        <button type="button" onClick={refresh} className="font-semibold underline">
          Riprova
        </button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="py-1.5 text-[10px] italic text-slate-600" style={{ paddingLeft: childIndent }}>
        Nessun figlio
      </div>
    );
  }

  return (
    <ul role="group" className="space-y-0.5">
      {nodes.map((child) => (
        <NodeTreeItem
          key={child.id}
          node={child}
          activeNodeId={activeNodeId}
          activeNodePath={activeNodePath}
          expandedNodeIds={expandedNodeIds}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

function TreeStatus({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="p-5 text-center text-xs text-slate-500">
      {children}
    </div>
  );
}
