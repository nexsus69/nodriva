'use client';

import { useState } from 'react';
import type { RealtimeDebugEvent } from '../../cache/RealtimeCacheBridge';

function formatPayload(payload: unknown): string {
  try {
    const formatted = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    return formatted.length > 5000 ? `${formatted.slice(0, 5000)}\n… payload troncato` : formatted;
  } catch {
    return String(payload);
  }
}

export function RealtimeDebugOverlay({
  events,
  onClear,
}: {
  events: RealtimeDebugEvent[];
  onClear: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`fixed bottom-4 left-4 z-[9999] w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/95 text-xs text-slate-200 shadow-2xl backdrop-blur-md ${collapsed ? 'h-auto' : 'max-h-[min(620px,calc(100vh-2rem))]'}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" />
          <span className="font-bold uppercase tracking-wider text-[11px]">Pusher realtime</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{events.length}</span>
        </div>
        <div className="flex gap-1">
          {!collapsed && <button type="button" onClick={onClear} className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] hover:bg-slate-700">Azzera</button>}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] hover:bg-slate-700" aria-expanded={!collapsed}>
            {collapsed ? 'Espandi' : '—'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="max-h-[560px] space-y-1 overflow-y-auto p-2 font-mono">
          {events.length === 0 && <div className="p-4 text-center text-slate-500">Nessun evento ricevuto.</div>}
          {[...events].reverse().map((event) => (
            <details key={event.id} className="rounded border border-slate-800 bg-slate-900/70 p-2">
              <summary className="cursor-pointer list-none">
                <div className="flex gap-2 text-[10px]">
                  <span className="shrink-0 text-slate-500">{new Date(event.receivedAt).toLocaleTimeString()}</span>
                  <span className="font-bold text-violet-300">{event.eventName}</span>
                  <span className="truncate text-cyan-300" title={event.channelName}>{event.channelName}</span>
                </div>
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all border-t border-slate-800 pt-2 text-[10px] text-slate-400">{formatPayload(event.payload)}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
