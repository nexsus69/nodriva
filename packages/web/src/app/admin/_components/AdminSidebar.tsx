import Link from '@/app/components/navigation/GuardedLink';

const GROUPS = [
  ['PANORAMICA', [['Panoramica Admin', '/admin', '📊']]],
  ['GESTIONE SCHEMA', [['Tipi di Nodo ed Entità', '/admin/types', '🧱']]],
  ['SICUREZZA & ACCESSI (IAM)', [['Gestione Utenti', '/admin/users', '👥'], ['Ruoli e Permessi', '/admin/security/roles', '🛡️'], ['Assegnazione ambiti', '/admin/security/scopes', '🔒']]],
  ['GOVERNANCE DI SISTEMA', [['Capacità Runtime', '/admin/system/config', '⚙️'], ['Policy di Posizionamento', '/admin/system/placement-policies', '💾']]],
  ['AUDIT & COMPLIANCE', [['Registro di Audit e Log', '/admin/audit', '📜'], ['Cestino e Ripristino', '/admin/recycle-bin', '♻️']]],
] as const;

export function AdminSidebar({ pathname, open, onClose }: { pathname: string; open: boolean; onClose: () => void }) {
  return <>
    {open && <button type="button" aria-label="Chiudi menu amministrazione" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[2px] lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col justify-between border-r border-slate-200 bg-white/95 shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${open ? 'translate-x-0' : ''}`}>
      <div><div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between"><Link href="/admin" className="font-bold text-sm text-slate-900">⚙️ Centro di Controllo</Link><button type="button" onClick={onClose} aria-label="Chiudi menu amministrazione" className="lg:hidden">×</button></div>
        <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">{GROUPS.map(([title, items]) => <div key={title} className="space-y-1.5"><div className="px-3 text-[10px] font-semibold text-slate-500 tracking-wider">{title}</div>{items.map(([label, href, icon]) => { const active = href === '/admin' ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><span>{icon}</span><span>{label}</span></Link>; })}</div>)}</nav>
      </div>
      <div className="p-4 border-t border-slate-200 bg-slate-50"><Link href="/" onClick={onClose} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100">🌐 Area Operativa</Link></div>
    </aside>
  </>;
}
