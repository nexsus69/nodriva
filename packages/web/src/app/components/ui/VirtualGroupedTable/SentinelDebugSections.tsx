'use client';

import type { InfiniteListDebugInfo } from './types';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

function formatCursor(cursor: unknown): string {
  if (cursor === undefined || cursor === null) return '—';
  if (typeof cursor === 'string') return cursor;
  try { return JSON.stringify(cursor); } catch { return String(cursor); }
}

interface SemanticViewDebugPanelProps {
  debugInfo: InfiniteListDebugInfo;
  copied: boolean;
  onCopy: () => void;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export function SemanticViewDebugPanel({ debugInfo, copied, onCopy, onRefresh, onRetry }: SemanticViewDebugPanelProps) {
  const { t } = useAppLocale();
  return (
    <div className="space-y-2 px-2.5 py-2 bg-indigo-950/30 border border-indigo-800/60 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="font-bold text-indigo-300 uppercase text-[10px]">{t('debug.semanticView')}</span>
        <div className="flex gap-1">
          {onRefresh && <button type="button" onClick={onRefresh} className="px-2 py-0.5 rounded bg-indigo-800 hover:bg-indigo-700">{t('debug.refresh')}</button>}
          {onRetry && debugInfo.lastFailedAction && <button type="button" onClick={onRetry} className="px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-600">{t('common.retry')}</button>}
          <button type="button" onClick={onCopy} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700">{copied ? t('debug.copied') : t('debug.copy')}</button>
        </div>
      </div>
      <div className="break-all text-[9px] text-slate-400">{debugInfo.viewKey}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <span className="text-slate-500">{t('debug.status')}</span><span>{debugInfo.status}</span>
        <span className="text-slate-500">{t('debug.satisfaction')}</span><span>{debugInfo.satisfactionStatus}</span>
        <span className="text-slate-500">{t('debug.pagesDescriptors')}</span><span>{debugInfo.pageCount} / {debugInfo.descriptorCount}</span>
        <span className="text-slate-500">{t('debug.pageSizes')}</span><span>[{debugInfo.pageSizes.join(', ')}]</span>
        <span className="text-slate-500">{t('debug.visibleItems')}</span><span>{debugInfo.visibleItemCount}</span>
        <span className="text-slate-500">{t('debug.cacheRevision')}</span><span>{debugInfo.cacheRevision}</span>
        <span className="text-slate-500">{t('debug.lastIntent')}</span><span>{debugInfo.diagnostics?.lastIntent ?? '—'}</span>
        <span className="text-slate-500">{t('debug.extensions')}</span><span>{debugInfo.diagnostics?.forwardExtensions ?? 0} / {debugInfo.diagnostics?.backwardExtensions ?? 0}</span>
        <span className="text-slate-500">{t('debug.trimmed')}</span><span>{debugInfo.diagnostics?.trimmedHeadPages ?? 0} / {debugInfo.diagnostics?.trimmedTailPages ?? 0}</span>
        <span className="text-slate-500">{t('debug.updated')}</span><span>{debugInfo.updatedAt ? new Date(debugInfo.updatedAt).toLocaleTimeString() : '—'}</span>
      </div>
      <div className="space-y-1 text-[9px]">
        <div><span className="text-slate-500">{t('debug.previous')}:</span> <span className="break-all">{formatCursor(debugInfo.previousCursor)}</span></div>
        <div><span className="text-slate-500">{t('debug.next')}:</span> <span className="break-all">{formatCursor(debugInfo.nextCursor)}</span></div>
      </div>
      {debugInfo.error && <div className="text-rose-300 bg-rose-950/40 border border-rose-900 rounded p-1.5 text-[10px]">{debugInfo.error.code}: {debugInfo.error.message}</div>}
      <details className="rounded border border-slate-800 bg-slate-950/60 p-1.5">
        <summary className="cursor-pointer text-[10px] font-bold text-cyan-300">{t('debug.nodeCache')} ({debugInfo.nodeProjection.length})</summary>
        <div className="mt-1.5 space-y-1 text-[9px]">
          {debugInfo.nodeProjection.map((node) => <div key={node.id} className="grid grid-cols-[70px_1fr_auto] gap-1"><span className="text-slate-500">{node.id.slice(-6)}</span><span className="truncate" title={node.name}>{node.name}</span><span className="text-cyan-400">v{node.rowVersion ?? '?'}</span></div>)}
        </div>
      </details>
      <details className="rounded border border-slate-800 bg-slate-950/60 p-1.5">
        <summary className="cursor-pointer text-[10px] font-bold text-amber-300">{t('debug.recentNodeWrites')} ({debugInfo.recentNodeWrites.length})</summary>
        <div className="mt-1.5 space-y-1.5 text-[9px]">
          {debugInfo.recentNodeWrites.map((write, index) => (
            <div key={`${write.timestamp}-${write.id}-${index}`} className={`rounded border p-1 ${write.accepted ? 'border-slate-800 text-slate-300' : 'border-rose-900/70 bg-rose-950/30 text-rose-300'}`}>
              <div className="flex justify-between gap-2"><span>{write.source}</span><span>{write.accepted ? t('debug.accepted') : t('debug.rejected')}</span></div>
              <div className="text-slate-500">…{write.id.slice(-6)} v{write.previousVersion ?? '?'}→v{write.incomingVersion ?? '?'} · {write.incomingName ?? '—'}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

interface SentinelStatusCardProps {
  position: 'top' | 'bottom';
  count: number;
  hasMore: boolean;
  loading: boolean;
}

export function SentinelStatusCard({ position, count, hasMore, loading }: SentinelStatusCardProps) {
  const { t } = useAppLocale();
  const top = position === 'top';
  return (
    <div className="flex flex-col gap-1 px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><span className={`${top ? 'text-emerald-400' : 'text-sky-400'} font-bold`}>{top ? `🟢 ${t('debug.top')}` : `🔵 ${t('debug.bottom')}`}</span>{loading && <span className="animate-spin text-[10px] text-amber-400">⏳</span>}</div>
        <span className={`px-2 py-0.5 ${top ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-sky-950 border-sky-800 text-sky-300'} border font-bold rounded`}>{count}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/40 pt-1 mt-0.5"><span>{top ? 'hasMoreBackward' : 'hasMoreForward'}:</span><span className={hasMore ? `${top ? 'text-emerald-400' : 'text-sky-400'} font-bold` : 'text-rose-400 font-bold'}>{hasMore ? 'true' : 'false'}</span></div>
    </div>
  );
}

interface CompensationCardProps { compensation?: { timestamp: string; delta: number; direction: 'forward' | 'backward' } | null }

export function CompensationCard({ compensation }: CompensationCardProps) {
  const { t } = useAppLocale();
  return (
    <div className="flex flex-col gap-1 px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">🔧 {t('debug.lastScrollCompensation')}</div>
      {compensation ? (
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between"><span className="text-slate-400">{t('debug.timestamp')}:</span><span className="text-slate-200">{compensation.timestamp}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('debug.direction')}:</span><span className={compensation.direction === 'backward' ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>{compensation.direction === 'backward' ? t('debug.up') : t('debug.down')}</span></div>
          <div className="flex justify-between border-t border-slate-800/40 pt-0.5 mt-0.5"><span className="text-slate-400 font-bold">{t('debug.valueDelta')}:</span><span className="text-amber-300 font-bold">{compensation.delta > 0 ? `+${compensation.delta}` : compensation.delta} px</span></div>
        </div>
      ) : <div className="text-[10px] text-slate-500 italic py-0.5">{t('debug.noCompensation')}</div>}
    </div>
  );
}
