'use client';

/** Presents the first rebuilt module surface while legacy screens are migrated. */
import { usePathname } from 'next/navigation';
import Link from '@/app/components/navigation/GuardedLink';
import { adminModuleRegistry } from '@/adminPanel/AdminModuleRegistry';
import { findAdminModuleByRoute } from '@/adminPanel/AdminModule';

/** Renders an Admin Panel overview or a clear migration surface for a module. */
export default function AdminModulePage() {
  const pathname = usePathname();
  const selectedModule = findAdminModuleByRoute(adminModuleRegistry.all(), pathname);
  const isOverview = pathname === '/admin';
  return <div className="space-y-8">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Nodriva Admin Panel</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{isOverview ? 'Administration at a glance' : selectedModule?.label ?? 'Module'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{isOverview ? 'A modular control surface for the model, access, activity, and system configuration.' : selectedModule?.description ?? 'This module is being rebuilt on the shared Admin Panel foundation.'}</p></section>
    {isOverview ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{adminModuleRegistry.all().filter((item) => item.key !== 'overview').map((item) => <Link key={item.key} href={item.children?.[0]?.route ?? '/admin'} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300"><span className="text-2xl">{item.icon ?? '•'}</span><h3 className="mt-4 font-semibold text-slate-900">{item.label}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p></Link>)}</div> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8"><h3 className="text-lg font-semibold text-slate-900">Module migration in progress</h3><p className="mt-2 text-sm text-slate-500">The new shell and persistent workspace are active. The module-specific screen will be migrated next without changing its backend contract.</p></section>}
  </div>;
}
