const infrastructureItems = [
  { label: 'MOTORE DATABASE', color: 'text-emerald-400', value: 'PostgreSQL 16 (Porta 5433)' },
  { label: 'SERVIZI APPLICATIVI CORE', color: 'text-indigo-400', value: '@dashboard/core (Isolato)' },
  { label: 'WEB SERVER ACTIONS', color: 'text-purple-400', value: 'Zero Query SQL Dirette' },
] as const;

export function AdminInfrastructureStatus() {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><span>🛡️</span> Architettura & Stato Infrastruttura</h3>
        <span className="text-xs font-mono text-slate-400">Clean Architecture / DDD Modular Monolith</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        {infrastructureItems.map((item) => (
          <div key={item.label} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px]">{item.label}</span>
            <span className={`${item.color} font-semibold flex items-center gap-1.5`}><span className="w-2 h-2 rounded-full bg-current" /> {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
