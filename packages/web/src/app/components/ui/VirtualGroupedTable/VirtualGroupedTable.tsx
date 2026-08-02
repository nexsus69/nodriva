'use client';

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { VirtualGroupedTableProps } from './types';
import { VirtualTableHead } from './VirtualTableHead';
import { VirtualGroupHeader } from './VirtualGroupHeader';
import { VirtualTableRow } from './VirtualTableRow';
import { useSubtreeGrouping, GroupableItem } from './useSubtreeGrouping';
import { useSentinelObserver } from './useSentinelObserver';
import { useScrollAnchoring } from './useScrollAnchoring';
import { SentinelDebugOverlay } from './SentinelDebugOverlay';

export function VirtualGroupedTable<T extends GroupableItem>({
  items,
  columns,
  isLoading = false,
  isLoadingMoreForward = false,
  isLoadingMoreBackward = false,
  hasMoreForward = false,
  hasMoreBackward = false,
  canLoadMoreForward = true,
  canLoadMoreBackward = true,
  isError = false,
  errorMessage = 'Si è verificato un errore durante il caricamento dei dati.',
  onRetry,
  onLoadMoreForward,
  onLoadMoreBackward,
  renderGroupHeaderActions,
  renderRowActions,
  selectedIds,
  onSelectionChange,
  emptyStateMessage = 'Nessun elemento presente.',
  showDebugOverlay = process.env.NODE_ENV !== 'production',
  captureAnchorRef,
  debugInfo,
  onDebugRefresh,
  onDebugRetry,
}: VirtualGroupedTableProps<T> & { showDebugOverlay?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  // 1. Hook puro per il raggruppamento per nodeId (Layer 3 Sub-Module)
  const groupedItems = useSubtreeGrouping(items);

  // 2. Hook per l'ancoraggio dello scroll Strategy 1: Just-In-Time Capture (Layer 3 Sub-Module)
  const scrollAnchoring = useScrollAnchoring({
    containerRef,
    items,
    hasMoreBackward,
  });

  // Assegna il ref per abilitare la cattura all'istante T_1 (prima di setBufferState)
  useEffect(() => {
    if (!captureAnchorRef) return;
    captureAnchorRef.current = scrollAnchoring.captureAnchor;
    return () => {
      if (captureAnchorRef.current === scrollAnchoring.captureAnchor) {
        captureAnchorRef.current = null;
      }
    };
  }, [captureAnchorRef, scrollAnchoring.captureAnchor]);

  // 3. Hook per la gestione dell'IntersectionObserver 100% Nativo (Layer 3 Sub-Module)
  const sentinelObserver = useSentinelObserver({
    containerRef,
    topSentinelRef,
    bottomSentinelRef,
    hasMoreForward,
    hasMoreBackward,
    canLoadMoreForward,
    canLoadMoreBackward,
    isLoadingMoreForward,
    isLoadingMoreBackward,
    onLoadMoreForward,
    onLoadMoreBackward,
    onBeforeFetch: undefined, // Disabilita la cattura a T_0
  });

  // ─── CSS Grid Template ─────────────────────────────────────────────────────
  const gridTemplateColumns = useMemo(() => {
    const colWidths = columns.map((col) => col.width || '1fr');
    const parts: string[] = [];
    if (onSelectionChange) {
      parts.push('32px');
    }
    parts.push('32px');
    parts.push(...colWidths);
    if (renderRowActions) {
      parts.push('120px');
    }
    return parts.join(' ');
  }, [columns, onSelectionChange, renderRowActions]);

  // ─── Selezione ─────────────────────────────────────────────────────────────
  const isAllSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.every((item) => selectedIds.has(item.id));
  }, [selectedIds, items]);

  const handleToggleSelectAll = useCallback(() => {
    if (!onSelectionChange || !selectedIds) return;
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      const newSet = new Set(items.map((i) => i.id));
      onSelectionChange(newSet);
    }
  }, [onSelectionChange, selectedIds, isAllSelected, items]);

  const handleToggleSelect = useCallback(
    (id: string) => {
      if (!onSelectionChange || !selectedIds) return;
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      onSelectionChange(newSet);
    },
    [onSelectionChange, selectedIds]
  );

  const handleResetCounts = useCallback(() => {
    sentinelObserver.resetDebugCounts();
    scrollAnchoring.resetCompensationInfo();
  }, [sentinelObserver, scrollAnchoring]);

  return (
    <div
      ref={containerRef}
      role="table"
      aria-label="Tabella Virtualizzata Entità"
      className="relative flex h-full w-full flex-col overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ overflowAnchor: 'none' }}
    >
      {/* Finestra di Debug Sentinelle Overlay */}
      {showDebugOverlay && (
        <SentinelDebugOverlay
          topTriggerCount={sentinelObserver.topTriggerCount}
          bottomTriggerCount={sentinelObserver.bottomTriggerCount}
          lastTriggered={sentinelObserver.lastTriggered}
          lastTriggerTime={sentinelObserver.lastTriggerTime}
          hasMoreForward={hasMoreForward}
          hasMoreBackward={hasMoreBackward}
          isLoadingMoreForward={isLoadingMoreForward}
          isLoadingMoreBackward={isLoadingMoreBackward}
          onResetCounts={handleResetCounts}
          lastCompensation={scrollAnchoring.lastCompensation}
          debugInfo={debugInfo}
          onRefresh={onDebugRefresh}
          onRetry={onDebugRetry}
        />
      )}

      {/* Table Head */}
      <VirtualTableHead
        columns={columns}
        hasRowActions={!!renderRowActions}
        hasSelection={!!onSelectionChange}
        isAllSelected={isAllSelected}
        onToggleSelectAll={handleToggleSelectAll}
        gridTemplateColumns={gridTemplateColumns}
      />

      {/* Top Sentinel for Backward Scroll */}
      <div
        ref={topSentinelRef}
        className="h-2 w-full shrink-0"
        style={{ overflowAnchor: 'none' }}
        aria-hidden="true"
      />

      {/* Banner Error Rendering */}
      {isError && (
        <div
          className="flex shrink-0 items-center justify-between border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
          style={{ overflowAnchor: 'none' }}
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg bg-rose-600 px-2.5 py-1 font-medium text-white shadow-sm transition-colors hover:bg-rose-500"
            >
              Riprova
            </button>
          )}
        </div>
      )}

      {/* Main Body */}
      {isLoading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm font-medium">Caricamento dati in corso…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-xl">⌁</span>
          <span className="text-sm font-medium text-slate-600">{emptyStateMessage}</span>
        </div>
      ) : (
        <div role="rowgroup" className="flex flex-col w-full">
          {groupedItems.map((group, index) => (
            <React.Fragment key={`${group.nodeId}-${index}`}>
              <VirtualGroupHeader
                nodeId={group.nodeId}
                nodeName={group.nodeName}
                nodePath={group.nodePath}
                nodeDepth={group.nodeDepth}
                renderActions={renderGroupHeaderActions}
              />
              {group.items.map((item) => (
                <VirtualTableRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  isSelected={selectedIds?.has(item.id)}
                  onToggleSelect={onSelectionChange ? handleToggleSelect : undefined}
                  renderActions={renderRowActions}
                  gridTemplateColumns={gridTemplateColumns}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Bottom Sentinel for Forward Scroll */}
      <div
        ref={bottomSentinelRef}
        className="h-2 w-full shrink-0"
        style={{ overflowAnchor: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}
