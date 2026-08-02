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
    <section className="space-y-4 border-t border-slate-200 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Esplora dati</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Entità del sottoalbero</h2></div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-500 shadow-sm">{items.length} caricate</span>
      </div>
      <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            <span className="rounded-full border border-indigo-100 bg-white px-2 py-0.5 text-[10px] font-mono text-indigo-600">
              {nodeName}
            </span>
          )}
          renderRowActions={({ item }) => (
            <Link
              href={`/nodes/${item.parentNodeId}/entities/${item.id}`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Apri →
            </Link>
          )}
        />
      </div>
    </section>
  );
}
