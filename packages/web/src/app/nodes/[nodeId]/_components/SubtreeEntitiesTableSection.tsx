'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  SubtreeEntityItem,
  useVirtualSubtreeData,
} from '../../../hooks/useVirtualSubtreeData';
import {
  VirtualGroupedTable,
  VirtualTableColumnDef,
} from '../../../components/ui/VirtualGroupedTable';

export interface SubtreeEntitiesTableSectionProps {
  nodeId: string;
}

export function SubtreeEntitiesTableSection({
  nodeId,
}: SubtreeEntitiesTableSectionProps) {
  const captureAnchorRef = useRef<
    ((direction: 'forward' | 'backward') => void) | null
  >(null);

  const {
    debugInfo,
    items,
    isLoading,
    isLoadingMoreForward,
    isLoadingMoreBackward,
    hasMoreForward,
    hasMoreBackward,
    canLoadMoreForward,
    canLoadMoreBackward,
    loadMoreForward,
    loadMoreBackward,
    refresh,
    retry,
  } = useVirtualSubtreeData({
    baseNodeId: nodeId,
    pageSize: 15,
    captureAnchorRef,
  });

  const columns: VirtualTableColumnDef<
    SubtreeEntityItem & { nodeId: string }
  >[] = [
    { key: 'name', header: 'Nome Entità', width: '1.5fr' },
    { key: 'entityTypeId', header: 'Tipo', width: '1fr' },
    { key: 'rowVersion', header: 'Versione', width: '0.8fr' },
    {
      key: 'createdAt',
      header: 'Creato Il',
      width: '1.5fr',
      render: (item) => (
        <span className="font-mono text-xs text-slate-400">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const formattedItems = items.map((item) => ({
    ...item,
    nodeId: item.parentNodeId,
  }));

  return (
    <div className="space-y-3 pt-4 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
          <span>📊</span> Tabella Virtualizzata Sottoalbero Entità ({items.length})
        </h2>
      </div>
      <div className="h-[420px] w-full">
        <VirtualGroupedTable
          items={formattedItems}
          columns={columns}
          isLoading={isLoading}
          isLoadingMoreForward={isLoadingMoreForward}
          isLoadingMoreBackward={isLoadingMoreBackward}
          hasMoreForward={hasMoreForward}
          hasMoreBackward={hasMoreBackward}
          canLoadMoreForward={canLoadMoreForward}
          canLoadMoreBackward={canLoadMoreBackward}
          onLoadMoreForward={loadMoreForward}
          onLoadMoreBackward={loadMoreBackward}
          captureAnchorRef={captureAnchorRef}
          debugInfo={debugInfo}
          onDebugRefresh={refresh}
          onDebugRetry={retry}
          renderGroupHeaderActions={({ nodeName }) => (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
              {nodeName}
            </span>
          )}
          renderRowActions={({ item }) => (
            <Link
              href={`/nodes/${item.parentNodeId}/entities/${item.id}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Apri →
            </Link>
          )}
          showDebugOverlay
        />
      </div>
    </div>
  );
}
