'use client';

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { InfiniteListDebugInfo } from './types';
import { CompensationCard, SemanticViewDebugPanel, SentinelStatusCard } from './SentinelDebugSections';

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
  lastCompensation?: { timestamp: string; delta: number; direction: 'forward' | 'backward' } | null;
  debugInfo?: InfiniteListDebugInfo;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export function SentinelDebugOverlay(props: SentinelDebugOverlayProps) {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const panelStyle: CSSProperties | undefined = position ? { left: position.x, top: position.y, right: 'auto' } : undefined;
  const bodyStyle: CSSProperties = { maxHeight: `calc(100vh - ${(position?.y ?? 16) + 60}px)` };

  const toggleCollapsed = () => {
    if (isCollapsed && position) setPosition({ x: Math.min(position.x, Math.max(8, window.innerWidth - 398)), y: position.y });
    setIsCollapsed((current) => !current);
  };

  const startDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !panelRef.current || (event.target as HTMLElement).closest('button')) return;
    const bounds = panelRef.current.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePanel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;
    const maxX = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    setPosition({ x: Math.min(Math.max(8, event.clientX - drag.offsetX), maxX), y: Math.min(Math.max(8, event.clientY - drag.offsetY), maxY) });
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const copyDiagnostics = async () => {
    if (!props.debugInfo) return;
    await navigator.clipboard.writeText(JSON.stringify({
      ...props.debugInfo,
      sentinels: {
        topTriggerCount: props.topTriggerCount,
        bottomTriggerCount: props.bottomTriggerCount,
        lastTriggered: props.lastTriggered,
        lastTriggerTime: props.lastTriggerTime,
        hasMoreForward: props.hasMoreForward,
        hasMoreBackward: props.hasMoreBackward,
        isLoadingMoreForward: props.isLoadingMoreForward,
        isLoadingMoreBackward: props.isLoadingMoreBackward,
      },
      lastCompensation: props.lastCompensation,
    }, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div ref={panelRef} style={panelStyle} className={`fixed top-2 right-2 sm:top-4 sm:right-4 z-[9999] max-w-[calc(100vw-1rem)] border border-slate-700/80 bg-slate-950/95 shadow-2xl text-slate-200 text-xs font-mono backdrop-blur-md ${isCollapsed ? 'w-[min(280px,calc(100vw-1rem))] rounded-lg' : 'w-[min(390px,calc(100vw-1rem))] rounded-xl'}`}>
      <div onPointerDown={startDragging} onPointerMove={movePanel} onPointerUp={stopDragging} onPointerCancel={stopDragging} className={`flex touch-none select-none items-center justify-between px-3.5 py-2.5 cursor-move ${isCollapsed ? '' : 'border-b border-slate-800'}`} title="Trascina per spostare il pannello">
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /><span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">Debug Lista & Cache</span></div>
        <div className="flex items-center gap-1">
          {!isCollapsed && <><button type="button" onClick={() => setPosition(null)} className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700" title="Riporta in alto a destra">↗</button><button type="button" onClick={props.onResetCounts} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition-colors border border-slate-700" title="Azzera Conteggi">Azzera</button></>}
          <button type="button" onClick={toggleCollapsed} className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700" aria-expanded={!isCollapsed} title={isCollapsed ? 'Espandi pannello' : 'Collassa pannello'}>{isCollapsed ? '▢' : '—'}</button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={bodyStyle} className="space-y-2 overflow-y-auto p-3.5 pt-2.5">
          {props.debugInfo && <SemanticViewDebugPanel debugInfo={props.debugInfo} copied={copied} onCopy={() => { void copyDiagnostics(); }} onRefresh={props.onRefresh} onRetry={props.onRetry} />}
          <SentinelStatusCard position="top" count={props.topTriggerCount} hasMore={props.hasMoreBackward} loading={props.isLoadingMoreBackward} />
          <SentinelStatusCard position="bottom" count={props.bottomTriggerCount} hasMore={props.hasMoreForward} loading={props.isLoadingMoreForward} />
          <CompensationCard compensation={props.lastCompensation} />
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/40 border border-slate-800/60 rounded-lg text-slate-400"><span>Modalità:</span><span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">NATIVE OBSERVER (0% CPU)</span></div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 px-1 border-t border-slate-800/60">
            <span>Ultimo Trigger:</span>
            <span className="font-semibold text-slate-300">{props.lastTriggered ? <span className={props.lastTriggered === 'top' ? 'text-emerald-400' : 'text-sky-400'}>{props.lastTriggered.toUpperCase()} ({props.lastTriggerTime})</span> : 'Nessuno'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
