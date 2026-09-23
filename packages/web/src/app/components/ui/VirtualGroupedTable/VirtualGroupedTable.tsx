'use client';

import type { GroupableItem } from './useSubtreeGrouping';
import type { VirtualGroupedTableProps } from './types';
import { SentinelDebugOverlay } from './SentinelDebugOverlay';
import { VirtualGroupedTableBody } from './VirtualGroupedTableBody';
import { VirtualTableHead } from './VirtualTableHead';
import { useVirtualGroupedTableController } from './useVirtualGroupedTableController';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

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
  errorMessage,
  onRetry,
  onLoadMoreForward,
  onLoadMoreBackward,
  renderGroupHeaderActions,
  renderRowActions,
  selectedIds,
  onSelectionChange,
  emptyStateMessage,
  showDebugOverlay = false,
  captureAnchorRef,
  debugInfo,
  onDebugRefresh,
  onDebugRetry,
}: VirtualGroupedTableProps<T> & { showDebugOverlay?: boolean }) {
  const { t } = useAppLocale();
  const {
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
  } = useVirtualGroupedTableController({
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
    hasRowActions: !!renderRowActions,
    captureAnchorRef,
  });

  return (
    <div
      ref={containerRef}
      role="table"
      aria-label={t('table.virtualizedEntities')}
      className="relative flex h-full w-full flex-col overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ overflowAnchor: 'none' }}
    >
      {showDebugOverlay && (
        <SentinelDebugOverlay
          topTriggerCount={topTriggerCount}
          bottomTriggerCount={bottomTriggerCount}
          lastTriggered={lastTriggered}
          lastTriggerTime={lastTriggerTime}
          hasMoreForward={hasMoreForward}
          hasMoreBackward={hasMoreBackward}
          isLoadingMoreForward={isLoadingMoreForward}
          isLoadingMoreBackward={isLoadingMoreBackward}
          onResetCounts={resetDiagnostics}
          lastCompensation={lastCompensation}
          debugInfo={debugInfo}
          onRefresh={onDebugRefresh}
          onRetry={onDebugRetry}
        />
      )}

      <VirtualTableHead
        columns={columns}
        hasRowActions={!!renderRowActions}
        hasSelection={!!onSelectionChange}
        isAllSelected={isAllSelected}
        onToggleSelectAll={handleToggleSelectAll}
        gridTemplateColumns={gridTemplateColumns}
      />

      <div
        ref={topSentinelRef}
        className="h-2 w-full shrink-0"
        style={{ overflowAnchor: 'none' }}
        aria-hidden="true"
      />

      <VirtualGroupedTableBody
        items={items}
        groupedItems={groupedItems}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage ?? t('table.loadError')}
        onRetry={onRetry}
        emptyStateMessage={emptyStateMessage ?? t('table.empty')}
        selectedIds={selectedIds}
        onToggleSelect={onSelectionChange ? handleToggleSelect : undefined}
        renderGroupHeaderActions={renderGroupHeaderActions}
        renderRowActions={renderRowActions}
        gridTemplateColumns={gridTemplateColumns}
      />

      <div
        ref={bottomSentinelRef}
        className="h-2 w-full shrink-0"
        style={{ overflowAnchor: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}
