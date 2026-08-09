import Link from 'next/link';

type AdminModuleAccent = 'indigo' | 'blue' | 'purple' | 'emerald' | 'amber';

export interface AdminModuleCardProps {
  icon: string;
  badge: string;
  title: string;
  description: string;
  footer: string;
  href: string;
  action: string;
  accent: AdminModuleAccent;
}

const accentStyles: Record<AdminModuleAccent, { border: string; icon: string; badge: string; title: string; action: string }> = {
  indigo: { border: 'hover:border-indigo-500/40', icon: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20', title: 'group-hover:text-indigo-300', action: 'text-indigo-400 hover:text-indigo-300' },
  blue: { border: 'hover:border-blue-500/40', icon: 'bg-blue-500/10 border-blue-500/20 text-blue-400', badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20', title: 'group-hover:text-blue-300', action: 'text-blue-400 hover:text-blue-300' },
  purple: { border: 'hover:border-purple-500/40', icon: 'bg-purple-500/10 border-purple-500/20 text-purple-400', badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20', title: 'group-hover:text-purple-300', action: 'text-purple-400 hover:text-purple-300' },
  emerald: { border: 'hover:border-emerald-500/40', icon: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', title: 'group-hover:text-emerald-300', action: 'text-emerald-400 hover:text-emerald-300' },
  amber: { border: 'hover:border-amber-500/40', icon: 'bg-amber-500/10 border-amber-500/20 text-amber-400', badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20', title: 'group-hover:text-amber-300', action: 'text-amber-400 hover:text-amber-300' },
};

export function AdminModuleCard({ icon, badge, title, description, footer, href, action, accent }: AdminModuleCardProps) {
  const styles = accentStyles[accent];
  return (
    <div className={`glass-panel rounded-2xl p-6 border border-slate-800/80 ${styles.border} transition-all flex flex-col justify-between group`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl ${styles.icon}`}>{icon}</div>
          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${styles.badge}`}>{badge}</span>
        </div>
        <div>
          <h2 className={`text-base font-bold text-slate-200 ${styles.title} transition-colors`}>{title}</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
        <span className="text-xs text-slate-500 font-mono">{footer}</span>
        <Link href={href} className={`text-xs font-semibold flex items-center gap-1 ${styles.action}`}>{action} &rarr;</Link>
      </div>
    </div>
  );
}
