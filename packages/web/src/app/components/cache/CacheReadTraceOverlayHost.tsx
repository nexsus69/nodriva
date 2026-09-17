/** Hosts the opt-in cache read diagnostic without coupling screens to cache internals. */
'use client';

import { useEffect, useState } from 'react';
import { AppCache } from '../../cache/GlobalCacheClient';
import type { CacheReadTraceEvent } from '../../cache/CacheReadTraceStore';

/** Renders recent cache decisions only when the explicit diagnostic flags are enabled. */
export function CacheReadTraceOverlayHost() {
  const enabled = process.env.NEXT_PUBLIC_DEBUG_OVERLAYS === 'true' && process.env.NEXT_PUBLIC_CACHE_DEBUG === 'true';
  const [events, setEvents] = useState<readonly CacheReadTraceEvent[]>(() => AppCache.cacheReadTrace.getEvents());
  useEffect(() => enabled ? AppCache.cacheReadTrace.subscribe(setEvents) : undefined, [enabled]);
  if (!enabled) return null;
  return <div className="fixed bottom-4 right-4 z-[9999] w-[min(560px,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-950/95 p-3 font-mono text-xs text-slate-200 shadow-2xl">
    <div className="mb-2 flex items-center justify-between"><strong>Cache pagine</strong><button type="button" onClick={() => AppCache.cacheReadTrace.clear()} className="rounded border border-slate-700 px-2 py-0.5">Azzera</button></div>
    <div className="max-h-64 space-y-1 overflow-auto">{[...events].reverse().map((event) => <div key={event.id} className="rounded border border-slate-800 p-2"><span className={event.source === 'cache' ? 'text-emerald-300' : event.source === 'backend' ? 'text-amber-300' : 'text-violet-300'}>{event.source ?? 'invalidazione'}</span>{' · '}{event.reason}{' · '}<span className="text-slate-400">{event.key}</span></div>)}{events.length === 0 && <p className="text-slate-500">Nessuna lettura registrata.</p>}</div>
  </div>;
}
