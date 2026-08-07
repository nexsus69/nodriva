'use client';

import { useEffect, useState } from 'react';
import { runtimeTiming } from '../../config/runtimeTiming';
import { useHumanActivity } from './ActivityProvider';
import type {
  ActivityDebugSnapshot,
  DebugOutcome,
} from './ActivityDebugStore';

const OUTCOME_STYLE: Record<DebugOutcome, string> = {
  idle: 'bg-slate-700 text-slate-300',
  running: 'bg-amber-500/20 text-amber-300',
  success: 'bg-emerald-500/20 text-emerald-300',
  unauthorized: 'bg-rose-500/20 text-rose-300',
  'network-error': 'bg-orange-500/20 text-orange-300',
  'server-error': 'bg-rose-500/20 text-rose-300',
};

function localTime(value?: string): string {
  return value ? new Date(value).toLocaleTimeString() : '—';
}

function remaining(value: string | undefined, now: number): string {
  if (!value) return '—';
  const milliseconds = Date.parse(value) - now;
  if (!Number.isFinite(milliseconds)) return 'non valida';
  const absoluteSeconds = Math.ceil(Math.abs(milliseconds) / 1000);
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = absoluteSeconds % 60;
  const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return milliseconds >= 0 ? formatted : `scaduta +${formatted}`;
}

function OutcomeBadge({ outcome }: { outcome: DebugOutcome }) {
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${OUTCOME_STYLE[outcome]}`}>{outcome}</span>;
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/70 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-[11px] text-slate-200">{children}</div>
    </div>
  );
}

export function ActivityDebugOverlay({
  snapshot,
  onClear,
}: {
  snapshot: ActivityDebugSnapshot;
  onClear: () => void;
}) {
  const { timing } = useHumanActivity();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      runtimeTiming.debugPanelRefreshIntervalMs,
    );
    return () => window.clearInterval(timer);
  }, []);

  const sessionRemaining = remaining(snapshot.sessionExpiresAt, now);
  const nextHeartbeatAllowedAt = snapshot.lastHeartbeatAt
    ? new Date(Date.parse(snapshot.lastHeartbeatAt) + timing.activityHeartbeatThrottleMs).toISOString()
    : undefined;
  const heartbeatReady = nextHeartbeatAllowedAt
    ? remaining(nextHeartbeatAllowedAt, now)
    : 'pronto';

  return (
    <div className={`fixed bottom-4 right-4 z-[9999] w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-cyan-900/80 bg-slate-950/95 font-mono text-xs text-slate-200 shadow-2xl backdrop-blur-md ${collapsed ? 'h-auto' : 'max-h-[min(720px,calc(100vh-2rem))]'}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${snapshot.authenticated ? 'animate-pulse bg-cyan-400' : 'bg-slate-600'}`} />
          <span className="truncate text-[11px] font-bold uppercase tracking-wider">Activity / Sync</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{snapshot.pageVisibility}</span>
        </div>
        <div className="flex gap-1">
          {!collapsed && (
            <button type="button" onClick={onClear} className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] hover:bg-slate-700">Azzera</button>
          )}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] hover:bg-slate-700" aria-expanded={!collapsed}>
            {collapsed ? 'Espandi' : '—'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-[660px] space-y-2 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <Metric label="Sessione">{sessionRemaining}</Metric>
            <Metric label="Heartbeat">
              <span className="flex items-center gap-1"><OutcomeBadge outcome={snapshot.heartbeatStatus} /> #{snapshot.heartbeatCount}</span>
            </Metric>
            <Metric label="Prossimo HB">{heartbeatReady}</Metric>
            <Metric label="Polling">
              <span className="flex items-center gap-1"><OutcomeBadge outcome={snapshot.syncStatus} /> #{snapshot.syncCount}</span>
            </Metric>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            <Metric label="Ultima attività">{snapshot.lastHumanActivityType ?? '—'} · {localTime(snapshot.lastHumanActivityAt)}</Metric>
            <Metric label="Ultimo heartbeat">{localTime(snapshot.lastHeartbeatAt)} · {snapshot.lastHeartbeatDurationMs ?? '—'} ms</Metric>
            <Metric label="Ultimo polling">{localTime(snapshot.lastSyncAt)} · {snapshot.lastSyncDurationMs ?? '—'} ms</Metric>
            <Metric label="Attività / limitate">{snapshot.humanActivityCount} / {snapshot.heartbeatThrottledCount}</Metric>
            <Metric label="Canali data / lock">{snapshot.dataChannelCount} / {snapshot.lockChannelCount}</Metric>
            <Metric label="Radici virtuali">{snapshot.virtualRootCount}</Metric>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/70 p-2">
            <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-slate-500">
              <span>Lock attivi</span>
              <span>{snapshot.activeLocks.length} · rinnovati {snapshot.renewedLockCount}</span>
            </div>
            {snapshot.activeLocks.length === 0 ? (
              <div className="text-[10px] text-slate-600">Nessun lock registrato</div>
            ) : snapshot.activeLocks.map((lock) => (
              <div key={`${lock.resourceType}:${lock.resourceId}`} className="truncate text-[10px] text-cyan-300" title={lock.resourceId}>
                {lock.resourceType}: {lock.resourceId}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {snapshot.events.length === 0 && (
              <div className="p-3 text-center text-[10px] text-slate-600">Nessun evento diagnostico.</div>
            )}
            {[...snapshot.events].reverse().slice(0, 40).map((event) => (
              <div key={event.id} className="flex items-start gap-2 rounded border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-[10px]">
                <span className="shrink-0 text-slate-600">{localTime(event.occurredAt)}</span>
                <span className="w-16 shrink-0 font-semibold text-cyan-400">{event.category}</span>
                <OutcomeBadge outcome={event.outcome} />
                <span className="min-w-0 break-words text-slate-400">{event.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
