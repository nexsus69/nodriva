import { ReactNode, RefObject } from 'react';
import type { SatisfactionStatus, ViewError, ViewStatus } from '../../../cache/ViewStore';
import type { CacheWriteDiagnostic } from '../../../cache/DomainCacheClient';

export interface InfiniteListDebugInfo {
  viewKey: string;
  status: ViewStatus;
  satisfactionStatus: SatisfactionStatus;
  pageCount: number;
  pageSizes: number[];
  descriptorCount: number;
  visibleItemCount: number;
  cacheRevision: number;
  nodeProjection: Array<{
    id: string;
    name: string;
    rowVersion?: number;
  }>;
  recentNodeWrites: CacheWriteDiagnostic[];
  previousCursor: unknown;
  nextCursor: unknown;
  updatedAt: number | null;
  error: ViewError | null;
  lastFailedAction: 'initial' | 'forward' | 'backward' | null;
  diagnostics: {
    forwardExtensions: number;
    backwardExtensions: number;
    trimmedHeadPages: number;
    trimmedTailPages: number;
    lastIntent: 'resolve' | 'forward' | 'backward';
  } | null;
}

export interface VirtualTableColumnDef<T> {
  key: string;
  header: string;
  width?: string; // CSS width value e.g. '200px' or '1fr'
  render?: (item: T) => ReactNode;
}

export interface GroupHeaderSlotProps {
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
  groupItemCount?: number;
}

export interface RowActionSlotProps<T> {
  item: T;
}

export interface VirtualGroupedTableProps<T extends { id: string; nodeId: string; nodeName: string; nodePath: string; nodeDepth: number }> {
  items: T[];
  columns: VirtualTableColumnDef<T>[];
  isLoading?: boolean;
  isLoadingMoreForward?: boolean;
  isLoadingMoreBackward?: boolean;
  hasMoreForward?: boolean;
  hasMoreBackward?: boolean;
  canLoadMoreForward?: boolean;
  canLoadMoreBackward?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onLoadMoreForward?: () => void;
  onLoadMoreBackward?: () => void;
  renderGroupHeaderActions?: (props: GroupHeaderSlotProps) => ReactNode;
  renderRowActions?: (props: RowActionSlotProps<T>) => ReactNode;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  emptyStateMessage?: string;
  captureAnchorRef?: RefObject<((direction: 'forward' | 'backward') => void) | null>;
  debugInfo?: InfiniteListDebugInfo;
  onDebugRefresh?: () => void;
  onDebugRetry?: () => void;
}
