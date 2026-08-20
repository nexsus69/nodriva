import { Skeleton, SkeletonState } from '@/app/components/ui/feedback';
import type { CapabilityStatus, RuntimeCapabilityDto } from '@dashboard/core';

export interface RuntimeCapabilitiesGridProps {
  capabilities: readonly RuntimeCapabilityDto[];
  loading: boolean;
  isPending: boolean;
  onStatusChange: (capabilityKey: string, status: CapabilityStatus) => void;
}

export function RuntimeCapabilitiesGrid({ capabilities, loading, isPending, onStatusChange }: RuntimeCapabilitiesGridProps) {
  if (loading) return <SkeletonState label="Caricamento capabilities" className="col-span-3 grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((card) => <div key={card} className="glass-panel space-y-4 rounded-2xl border border-slate-800 p-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><div className="flex justify-between border-t border-slate-800 pt-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-28" /></div></div>)}</SkeletonState>;
  if (capabilities.length === 0) return <div className="col-span-3 glass-panel p-6 text-center text-xs text-slate-500">Nessuna capability registrata.</div>;
  return <>{capabilities.map((capability) => <div key={capability.id} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between"><div><div className="flex items-center justify-between gap-2 mb-1"><span className="font-mono font-semibold text-xs text-purple-300">{capability.capabilityKey}</span>{capability.isSystem && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">SYSTEM</span>}</div><h3 className="text-sm font-bold text-slate-100">{capability.name}</h3><p className="text-xs text-slate-400 mt-1">{capability.description}</p></div><div className="pt-3 border-t border-slate-800/80 flex items-center justify-between"><span className="text-[11px] text-slate-400 font-mono">Stato Attivo:</span><select disabled={isPending} value={capability.currentStatus} onChange={(event) => onStatusChange(capability.capabilityKey, event.target.value as CapabilityStatus)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-purple-500"><option value="enabled">ENABLED (Abilitato)</option><option value="disabled">DISABLED (Disabilitato)</option><option value="optional">OPTIONAL (Opzionale)</option></select></div></div>)}</>;
}
