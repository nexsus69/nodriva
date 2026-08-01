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
  showDebugOverlay = true,
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
      className="relative flex flex-col w-full h-full bg-slate-900 border border-slate-800 rounded-lg overflow-auto shadow-xl"
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
          className="flex items-center justify-between px-4 py-3 bg-red-950/80 border-b border-red-800/80 text-red-200 text-xs shrink-0"
          style={{ overflowAnchor: 'none' }}
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white font-medium rounded transition-colors shadow-sm"
            >
              Riprova
            </button>
          )}
        </div>
      )}

      {/* Main Body */}
      {isLoading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <span className="animate-spin text-2xl">⏳</span>
          <span className="text-sm font-medium">Caricamento tabella in corso...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <span className="text-2xl">📭</span>
          <span className="text-sm font-medium">{emptyStateMessage}</span>
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
