import { LoginBrandPanel } from './_components/LoginBrandPanel';
import { LoginFormPanel } from './_components/LoginFormPanel';

export default function LoginPage() {
  return <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-900"><div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-100/40 to-violet-100/50" /><div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-5 py-8"><div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-2xl lg:grid-cols-[1.05fr_.95fr]"><LoginBrandPanel /><LoginFormPanel /></div></div></main>;
}
