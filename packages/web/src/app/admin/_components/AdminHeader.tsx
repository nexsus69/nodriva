import { LogoutButton } from '../../components/ui/LogoutButton';
import { ResponsiveBreadcrumb, type BreadcrumbItem } from '../../components/navigation/Breadcrumb';

type Props = { breadcrumbs: BreadcrumbItem[]; email: string; initials: string; loadingSession: boolean; onOpenSidebar: () => void };

export function AdminHeader({ breadcrumbs, email, initials, loadingSession, onOpenSidebar }: Props) {
  return <header className="h-16 border-b border-slate-200 bg-white/85 px-4 sm:px-6 lg:px-8 flex items-center justify-between z-10"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onOpenSidebar} aria-label="Apri menu amministrazione" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden">☰</button><ResponsiveBreadcrumb items={breadcrumbs} ariaLabel="Breadcrumb amministrazione" /></div><div className="flex shrink-0 items-center gap-3"><div className="hidden items-center gap-3 sm:flex"><div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">{loadingSession ? '..' : initials}</div><span className="text-xs font-semibold text-slate-800">{loadingSession ? 'Caricamento...' : email}</span></div><LogoutButton /></div></header>;
}
