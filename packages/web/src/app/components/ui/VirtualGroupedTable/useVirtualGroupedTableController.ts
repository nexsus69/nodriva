'use client';

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { VirtualTableColumnDef } from './types';
import { useScrollAnchoring } from './useScrollAnchoring';
import { useSentinelObserver } from './useSentinelObserver';
import { useSubtreeGrouping, type GroupableItem } from './useSubtreeGrouping';
import {
  areAllItemsSelected,
  buildGridTemplateColumns,
  toggleAllItems,
  toggleItemSelection,
} from './virtualTableModel';

interface VirtualGroupedTableControllerOptions<T extends GroupableItem> {
  items: T[];
  columns: VirtualTableColumnDef<T>[];
  hasMoreForward: boolean;
  hasMoreBackward: boolean;
  canLoadMoreForward: boolean;
  canLoadMoreBackward: boolean;
  isLoadingMoreForward: boolean;
  isLoadingMoreBackward: boolean;
  onLoadMoreForward?: () => void;
  onLoadMoreBackward?: () => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  hasRowActions: boolean;
  captureAnchorRef?: RefObject<((direction: 'forward' | 'backward') => void) | null>;
}

export function useVirtualGroupedTableController<T extends GroupableItem>({
  items,
  columns,
  hasMoreForward,
  hasMoreBackward,
  canLoadMoreForward,
  canLoadMoreBackward,
  isLoadingMoreForward,
  isLoadingMoreBackward,
  onLoadMoreForward,
  onLoadMoreBackward,
  selectedIds,
  onSelectionChange,
  hasRowActions,
  captureAnchorRef,
}: VirtualGroupedTableControllerOptions<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const groupedItems = useSubtreeGrouping(items);
  const scrollAnchoring = useScrollAnchoring({ containerRef, items, hasMoreBackward });
  const { captureAnchor, lastCompensation, resetCompensationInfo } = scrollAnchoring;

  useEffect(() => {
    if (!captureAnchorRef) return;
    captureAnchorRef.current = captureAnchor;
    return () => {
      if (captureAnchorRef.current === captureAnchor) captureAnchorRef.current = null;
    };
  }, [captureAnchor, captureAnchorRef]);

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
    onBeforeFetch: undefined,
  });
  const {
    topTriggerCount,
    bottomTriggerCount,
    lastTriggered,
    lastTriggerTime,
    resetDebugCounts,
  } = sentinelObserver;

  const gridTemplateColumns = useMemo(
    () => buildGridTemplateColumns(columns, !!onSelectionChange, hasRowActions),
    [columns, hasRowActions, onSelectionChange],
  );
  const isAllSelected = useMemo(
    () => areAllItemsSelected(items, selectedIds),
    [items, selectedIds],
  );

  const handleToggleSelectAll = useCallback(() => {
    if (!onSelectionChange || !selectedIds) return;
    onSelectionChange(toggleAllItems(items, selectedIds));
  }, [items, onSelectionChange, selectedIds]);

  const handleToggleSelect = useCallback((id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    onSelectionChange(toggleItemSelection(selectedIds, id));
  }, [onSelectionChange, selectedIds]);

  const resetDiagnostics = useCallback(() => {
    resetDebugCounts();
    resetCompensationInfo();
  }, [resetCompensationInfo, resetDebugCounts]);

  return {
    containerRef,
    topSentinelRef,
    bottomSentinelRef,
    groupedItems,
    gridTemplateColumns,
    isAllSelected,
    handleToggleSelectAll,
    handleToggleSelect,
    topTriggerCount,
    bottomTriggerCount,
    lastTriggered,
    lastTriggerTime,
    lastCompensation,
    resetDiagnostics,
  };
}
