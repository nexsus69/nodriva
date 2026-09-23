'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { LogoutButton } from '@/app/components/ui/LogoutButton';

/** Accessible account menu; sensitive mutations remain on dedicated account screens. */
export function CurrentAccountMenu({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return <details className={`group ${className}`}>
    <summary className="cursor-pointer list-none rounded-lg px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Account <span className="ml-1 text-slate-400 group-open:rotate-180">⌄</span></summary>
    <div className={`space-y-1 ${compact ? '' : 'pt-1'}`}>
      <Link href="/account" className="block rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white">Il mio account</Link>
      <Link href="/account/security" className="block rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white">Sicurezza e MFA</Link>
      <LogoutButton className="mt-2 w-full justify-center border-white/10 bg-white/5 text-slate-300 hover:bg-rose-500/10 hover:text-rose-300" />
    </div>
  </details>;
}
