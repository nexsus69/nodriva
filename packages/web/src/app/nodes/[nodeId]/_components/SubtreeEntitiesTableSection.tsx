'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SubtreeEntityItem,
  useVirtualSubtreeData,
} from '../../../hooks/useVirtualSubtreeData';
import {
  VirtualGroupedTable,
  VirtualTableColumnDef,
} from '../../../components/ui/VirtualGroupedTable';
import { useSemanticMetadata } from '../../../hooks/useSemanticMetadata';
import { EntityResourceMenu } from '../../../components/ui/menu';
import { Skeleton } from '../../../components/ui/feedback';
import { CustomSelect } from '../../../components/ui/forms';

export interface SubtreeEntitiesTableSectionProps {
  nodeId: string;
}

export function SubtreeEntitiesTableSection({
  nodeId,
}: SubtreeEntitiesTableSectionProps) {
  const { entityTypes } = useSemanticMetadata();
  const captureAnchorRef = useRef<
    ((direction: 'forward' | 'backward') => void) | null
  >(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lockState, setLockState] = useState<'locked' | 'unlocked' | ''>('');

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = {
    ...(name.trim() ? { name: name.trim() } : {}),
    ...(description.trim() ? { description: description.trim() } : {}),
    ...(lockState ? { lockState } : {}),
  };

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
    search,
    filters,
  });


  const columns = useMemo<VirtualTableColumnDef<
    SubtreeEntityItem & { nodeId: string }
  >[]>(() => [
    {
      key: 'name',
      header: 'Nome Entità',
      width: '1.5fr',
      render: (item) => (
        <div className="flex min-w-0 items-center gap-1">
          <Link href={`/nodes/${item.parentNodeId}/entities/${item.id}`} className="min-w-0 truncate font-semibold text-indigo-600 hover:text-indigo-700">{item.name}</Link>
          <EntityResourceMenu entityId={item.id} entityName={item.name} parentNodeId={item.parentNodeId} />
        </div>
      ),
    },
    {
      key: 'entityTypeId',
      header: 'Tipo',
      width: '1fr',
      render: (item) => {
        const entityType = Object.values(entityTypes).find(
          (type) => type.id === item.entityTypeId || type.typeKey === item.entityTypeId,
        );
        return entityType?.name ?? <Skeleton className="h-4 w-24" />;
      },
    },
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
  ], [entityTypes]);

  const formattedItems = items.map((item) => ({
    ...item,
    nodeId: item.parentNodeId,
  }));

  return (
    <section className="space-y-4 border-t border-slate-200 pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Esplora dati</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Entità del sottoalbero</h2></div>
        <span className="self-start rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-500 shadow-sm sm:self-auto">{items.length} caricate</span>
      </div>
      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cerca
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nome, nodo o ID" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nome
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contiene…" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descrizione
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contiene…" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
        </label>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Lock
          <div className="mt-1 normal-case tracking-normal">
            <CustomSelect
              id="subtree-lock-state"
              value={lockState}
              tone="light"
              placeholder="Tutti"
              options={[
                { value: 'locked', label: 'Bloccati' },
                { value: 'unlocked', label: 'Non bloccati' },
              ]}
              onChange={(value) => setLockState(value as typeof lockState)}
            />
          </div>
        </div>
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
          showDebugOverlay={process.env.NEXT_PUBLIC_SENTINEL_DEBUG === 'true'}
          debugInfo={debugInfo}
          onDebugRefresh={refresh}
          onDebugRetry={retry}
          renderGroupHeaderActions={({ nodeName }) => (
            <span className="rounded-full border border-indigo-100 bg-white px-2 py-0.5 text-[10px] font-mono text-indigo-600">
              {nodeName}
            </span>
          )}
          renderRowActions={({ item }) => (
            <div className="flex items-center gap-2">
              <Link href={`/nodes/${item.parentNodeId}/entities/${item.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Apri →</Link>
            </div>
          )}
        />
      </div>
    </section>
  );
}
