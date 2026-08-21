'use client';

/** Renders the recursive Admin Panel module tree and persists its workspace state. */
import { useEffect } from 'react';
import Link from '@/app/components/navigation/GuardedLink';
import { adminModuleRegistry } from '../_modules/AdminModuleRegistry';
import { findAdminModuleByRoute, type AdminModule } from '../_modules/AdminModule';
import { useAdminWorkspaceStore } from '../_state/AdminWorkspaceStore';

interface AdminModuleTreeProps {
  modules: readonly AdminModule[];
  pathname: string;
  activeModuleKey: string;
  expandedModuleKeys: readonly string[];
  onActivate: (module: AdminModule) => void;
  onToggle: (moduleKey: string) => void;
  onClose: () => void;
}

/** Recursively renders modules while keeping branch and leaf behavior identical. */
function AdminModuleTree({ modules, pathname, activeModuleKey, expandedModuleKeys, onActivate, onToggle, onClose }: AdminModuleTreeProps) {
  return <div className="space-y-1">
    {modules.map((module) => {
      const hasChildren = Boolean(module.children?.length);
      const expanded = expandedModuleKeys.includes(module.key);
      const active = activeModuleKey === module.key || (module.route === '/admin' ? pathname === module.route : Boolean(module.route && pathname.startsWith(module.route)));
      const className = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`;
      return <div key={module.key}>
        {module.route ? <Link href={module.route} onClick={() => { onActivate(module); onClose(); }} className={className}>
          <span aria-hidden="true" className="w-5 text-center">{module.icon ?? '•'}</span>
          <span className="min-w-0 flex-1 truncate">{module.label}</span>
          {hasChildren && <span aria-hidden="true" className="text-[10px]">{expanded ? '▾' : '▸'}</span>}
        </Link> : <button type="button" onClick={() => onToggle(module.key)} aria-expanded={expanded} className={className}>
          <span aria-hidden="true" className="w-5 text-center">{module.icon ?? '•'}</span>
          <span className="min-w-0 flex-1 truncate">{module.label}</span>
          {hasChildren && <span aria-hidden="true" className="text-[10px]">{expanded ? '▾' : '▸'}</span>}
        </button>}
        {hasChildren && expanded && <div className="ml-4 mt-1 border-l border-slate-200 pl-2"><AdminModuleTree modules={module.children!} pathname={pathname} activeModuleKey={activeModuleKey} expandedModuleKeys={expandedModuleKeys} onActivate={onActivate} onToggle={onToggle} onClose={onClose} /></div>}
      </div>;
    })}
  </div>;
}

/** Provides the responsive navigation frame for the administrative workspace. */
export function AdminSidebar({ pathname, open, onClose }: { pathname: string; open: boolean; onClose: () => void }) {
  const modules = adminModuleRegistry.all();
  const activeModuleKey = useAdminWorkspaceStore((state) => state.activeModuleKey);
  const expandedModuleKeys = useAdminWorkspaceStore((state) => state.expandedModuleKeys);
  const setActiveModule = useAdminWorkspaceStore((state) => state.setActiveModule);
  const expandModule = useAdminWorkspaceStore((state) => state.expandModule);
  const toggleModule = useAdminWorkspaceStore((state) => state.toggleModule);

  useEffect(() => {
    const activeModule = findAdminModuleByRoute(modules, pathname);
    if (!activeModule) return;
    setActiveModule(activeModule.key);
    const ancestors = activeModule.key.split('.').slice(0, -1);
    ancestors.forEach((_, index) => expandModule(ancestors.slice(0, index + 1).join('.')));
  }, [expandModule, modules, pathname, setActiveModule]);

  return <>
    {open && <button type="button" aria-label="Close administration menu" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[2px] lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col justify-between border-r border-slate-200 bg-white/95 shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${open ? 'translate-x-0' : ''}`}>
      <div>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <Link href="/admin" onClick={onClose} className="text-sm font-bold text-slate-900">⚙️ Admin Panel</Link>
          <button type="button" onClick={onClose} aria-label="Close administration menu" className="lg:hidden">×</button>
        </div>
        <nav aria-label="Administration modules" className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
          <AdminModuleTree modules={modules} pathname={pathname} activeModuleKey={activeModuleKey} expandedModuleKeys={expandedModuleKeys} onActivate={(module) => setActiveModule(module.key)} onToggle={toggleModule} onClose={onClose} />
        </nav>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 p-4"><Link href="/" onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 py-2.5 text-xs font-semibold text-slate-700">🌐 Operational area</Link></div>
    </aside>
  </>;
}
