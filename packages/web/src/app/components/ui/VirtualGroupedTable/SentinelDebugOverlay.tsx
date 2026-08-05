'use client';

import React, { CSSProperties, PointerEvent, useRef, useState } from 'react';
import type { InfiniteListDebugInfo } from './types';

export interface SentinelDebugOverlayProps {
  topTriggerCount: number;
  bottomTriggerCount: number;
  lastTriggered: 'top' | 'bottom' | null;
  lastTriggerTime: string | null;
  hasMoreForward: boolean;
  hasMoreBackward: boolean;
  isLoadingMoreForward: boolean;
  isLoadingMoreBackward: boolean;
  onResetCounts: () => void;
  lastCompensation?: {
    timestamp: string;
    delta: number;
    direction: 'forward' | 'backward';
  } | null;
  debugInfo?: InfiniteListDebugInfo;
  onRefresh?: () => void;
  onRetry?: () => void;
}

function formatCursor(cursor: unknown): string {
  if (cursor === undefined || cursor === null) return '—';
  if (typeof cursor === 'string') return cursor;
  try {
    return JSON.stringify(cursor);
  } catch {
    return String(cursor);
  }
}

export function SentinelDebugOverlay({
  topTriggerCount,
  bottomTriggerCount,
  lastTriggered,
  lastTriggerTime,
  hasMoreForward,
  hasMoreBackward,
  isLoadingMoreForward,
  isLoadingMoreBackward,
  onResetCounts,
  lastCompensation,
  debugInfo,
  onRefresh,
  onRetry,
}: SentinelDebugOverlayProps) {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const panelStyle: CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: 'auto' }
    : undefined;
  const bodyStyle: CSSProperties = {
    maxHeight: `calc(100vh - ${(position?.y ?? 16) + 60}px)`,
  };

  const toggleCollapsed = () => {
    if (isCollapsed && position) {
      setPosition({
        x: Math.min(position.x, Math.max(8, window.innerWidth - 398)),
        y: position.y,
      });
    }
    setIsCollapsed(!isCollapsed);
  };

  const startDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !panelRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;

    const bounds = panelRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePanel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;

    const maxX = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    setPosition({
      x: Math.min(Math.max(8, event.clientX - drag.offsetX), maxX),
      y: Math.min(Math.max(8, event.clientY - drag.offsetY), maxY),
    });
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const copyDiagnostics = async () => {
    if (!debugInfo) return;
    await navigator.clipboard.writeText(JSON.stringify({
      ...debugInfo,
      sentinels: {
        topTriggerCount,
        bottomTriggerCount,
        lastTriggered,
        lastTriggerTime,
        hasMoreForward,
        hasMoreBackward,
        isLoadingMoreForward,
        isLoadingMoreBackward,
      },
      lastCompensation,
    }, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      className={`fixed top-2 right-2 sm:top-4 sm:right-4 z-[9999] max-w-[calc(100vw-1rem)] border border-slate-700/80 bg-slate-950/95 shadow-2xl text-slate-200 text-xs font-mono backdrop-blur-md ${
        isCollapsed ? 'w-[min(280px,calc(100vw-1rem))] rounded-lg' : 'w-[min(390px,calc(100vw-1rem))] rounded-xl'
      }`}
    >
      {/* Header Finestra */}
      <div
        onPointerDown={startDragging}
        onPointerMove={movePanel}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        className={`flex touch-none select-none items-center justify-between px-3.5 py-2.5 cursor-move ${
          isCollapsed ? '' : 'border-b border-slate-800'
        }`}
        title="Trascina per spostare il pannello"
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
            Debug Lista & Cache
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <>
              <button
                type="button"
                onClick={() => setPosition(null)}
                className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                title="Riporta in alto a destra"
              >
                ↗
              </button>
              <button
                type="button"
                onClick={onResetCounts}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition-colors border border-slate-700"
                title="Azzera Conteggi"
              >
                Azzera
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Espandi pannello' : 'Collassa pannello'}
          >
            {isCollapsed ? '▢' : '—'}
          </button>
        </div>
      </div>

      {/* Grid Conteggi e Stato Sentinelle */}
      {!isCollapsed && (
      <div
        style={bodyStyle}
        className="space-y-2 overflow-y-auto p-3.5 pt-2.5"
      >
        {debugInfo && (
          <div className="space-y-2 px-2.5 py-2 bg-indigo-950/30 border border-indigo-800/60 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-300 uppercase text-[10px]">Semantic View</span>
              <div className="flex gap-1">
                {onRefresh && (
                  <button onClick={onRefresh} className="px-2 py-0.5 rounded bg-indigo-800 hover:bg-indigo-700">
                    Refresh
                  </button>
                )}
                {onRetry && debugInfo.lastFailedAction && (
                  <button onClick={onRetry} className="px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-600">
                    Retry
                  </button>
                )}
                <button onClick={() => void copyDiagnostics()} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700">
                  {copied ? 'Copiato' : 'Copia'}
                </button>
              </div>
            </div>
            <div className="break-all text-[9px] text-slate-400">{debugInfo.viewKey}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <span className="text-slate-500">status</span><span>{debugInfo.status}</span>
              <span className="text-slate-500">satisfaction</span><span>{debugInfo.satisfactionStatus}</span>
              <span className="text-slate-500">pages / descriptors</span><span>{debugInfo.pageCount} / {debugInfo.descriptorCount}</span>
              <span className="text-slate-500">page sizes</span><span>[{debugInfo.pageSizes.join(', ')}]</span>
              <span className="text-slate-500">visible items</span><span>{debugInfo.visibleItemCount}</span>
              <span className="text-slate-500">cache revision</span><span>{debugInfo.cacheRevision}</span>
              <span className="text-slate-500">last intent</span><span>{debugInfo.diagnostics?.lastIntent ?? '—'}</span>
              <span className="text-slate-500">extensions F/B</span>
              <span>{debugInfo.diagnostics?.forwardExtensions ?? 0} / {debugInfo.diagnostics?.backwardExtensions ?? 0}</span>
              <span className="text-slate-500">trimmed head/tail</span>
              <span>{debugInfo.diagnostics?.trimmedHeadPages ?? 0} / {debugInfo.diagnostics?.trimmedTailPages ?? 0}</span>
              <span className="text-slate-500">updated</span>
              <span>{debugInfo.updatedAt ? new Date(debugInfo.updatedAt).toLocaleTimeString() : '—'}</span>
            </div>
            <div className="space-y-1 text-[9px]">
              <div><span className="text-slate-500">prev:</span> <span className="break-all">{formatCursor(debugInfo.previousCursor)}</span></div>
              <div><span className="text-slate-500">next:</span> <span className="break-all">{formatCursor(debugInfo.nextCursor)}</span></div>
            </div>
            {debugInfo.error && (
              <div className="text-rose-300 bg-rose-950/40 border border-rose-900 rounded p-1.5 text-[10px]">
                {debugInfo.error.code}: {debugInfo.error.message}
              </div>
            )}
            <details className="rounded border border-slate-800 bg-slate-950/60 p-1.5">
              <summary className="cursor-pointer text-[10px] font-bold text-cyan-300">
                Node cache ({debugInfo.nodeProjection.length})
              </summary>
              <div className="mt-1.5 space-y-1 text-[9px]">
                {debugInfo.nodeProjection.map((node) => (
                  <div key={node.id} className="grid grid-cols-[70px_1fr_auto] gap-1">
                    <span className="text-slate-500">{node.id.slice(-6)}</span>
                    <span className="truncate" title={node.name}>{node.name}</span>
                    <span className="text-cyan-400">v{node.rowVersion ?? '?'}</span>
                  </div>
                ))}
              </div>
            </details>
            <details className="rounded border border-slate-800 bg-slate-950/60 p-1.5">
              <summary className="cursor-pointer text-[10px] font-bold text-amber-300">
                Ultime scritture nodi ({debugInfo.recentNodeWrites.length})
              </summary>
              <div className="mt-1.5 space-y-1.5 text-[9px]">
                {debugInfo.recentNodeWrites.map((write, index) => (
                  <div
                    key={`${write.timestamp}-${write.id}-${index}`}
                    className={`rounded border p-1 ${
                      write.accepted
                        ? 'border-slate-800 text-slate-300'
                        : 'border-rose-900/70 bg-rose-950/30 text-rose-300'
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span>{write.source}</span>
                      <span>{write.accepted ? 'accepted' : 'REJECTED'}</span>
                    </div>
                    <div className="text-slate-500">
                      …{write.id.slice(-6)} v{write.previousVersion ?? '?'}→v{write.incomingVersion ?? '?'} · {write.incomingName ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
        {/* Top Sentinel Status */}
        <div className="flex flex-col gap-1 px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">🟢 Top (Up)</span>
              {isLoadingMoreBackward && (
                <span className="animate-spin text-[10px] text-amber-400">⏳</span>
              )}
            </div>
            <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold rounded">
              {topTriggerCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/40 pt-1 mt-0.5">
            <span>hasMoreBackward:</span>
            <span className={hasMoreBackward ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hasMoreBackward ? 'true' : 'false'}
            </span>
          </div>
        </div>

        {/* Bottom Sentinel Status */}
        <div className="flex flex-col gap-1 px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-bold">🔵 Bottom (Down)</span>
              {isLoadingMoreForward && (
                <span className="animate-spin text-[10px] text-amber-400">⏳</span>
              )}
            </div>
            <span className="px-2 py-0.5 bg-sky-950 border border-sky-800 text-sky-300 font-bold rounded">
              {bottomTriggerCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/40 pt-1 mt-0.5">
            <span>hasMoreForward:</span>
            <span className={hasMoreForward ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold'}>
              {hasMoreForward ? 'true' : 'false'}
            </span>
          </div>
        </div>

        {/* Info Compensazione Scroll */}
        <div className="flex flex-col gap-1 px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">
            🔧 Last Scroll Compensation
          </div>
          {lastCompensation ? (
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">{lastCompensation.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Direzione:</span>
                <span className={lastCompensation.direction === 'backward' ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
                  {lastCompensation.direction === 'backward' ? 'UP (Backward)' : 'DOWN (Forward)'}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800/40 pt-0.5 mt-0.5">
                <span className="text-slate-400 font-bold">Valore (Delta):</span>
                <span className="text-amber-300 font-bold">
                  {lastCompensation.delta > 0 ? `+${lastCompensation.delta}` : lastCompensation.delta} px
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 italic py-0.5">
              Nessuna compensazione eseguita
            </div>
          )}
        </div>

        {/* Modalità Observer */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/40 border border-slate-800/60 rounded-lg text-slate-400">
          <span>Modalità:</span>
          <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
            NATIVE OBSERVER (0% CPU)
          </span>
        </div>

        {/* Ultimo Trigger Registrato */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 px-1 border-t border-slate-800/60">
          <span>Ultimo Trigger:</span>
          <span className="font-semibold text-slate-300">
            {lastTriggered ? (
              <span
                className={
                  lastTriggered === 'top' ? 'text-emerald-400' : 'text-sky-400'
                }
              >
                {lastTriggered.toUpperCase()} ({lastTriggerTime})
              </span>
            ) : (
              'Nessuno'
            )}
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
