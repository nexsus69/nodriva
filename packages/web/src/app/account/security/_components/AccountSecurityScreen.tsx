'use client';

import { useMfaSecurity } from '../_hooks/useMfaSecurity';

export function AccountSecurityScreen() {
  const controller = useMfaSecurity();
  return <main className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10"><div><h1 className="text-2xl font-semibold text-slate-900">Sicurezza account</h1><p className="mt-2 text-sm text-slate-600">Configura un autenticatore TOTP e conserva offline i codici di recupero.</p></div><section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    {!controller.enrollment && controller.recoveryCodes.length === 0 && <button disabled={controller.busy} onClick={controller.begin} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Avvia configurazione MFA</button>}
    {controller.enrollment && controller.recoveryCodes.length === 0 && <div className="space-y-4"><p className="text-sm text-slate-700">Aggiungi manualmente questo segreto nell’app autenticatore:</p><code className="block break-all rounded-lg bg-slate-100 p-3 text-sm">{controller.enrollment.secret}</code><details className="text-xs text-slate-500"><summary>URI otpauth</summary><code className="mt-2 block break-all">{controller.enrollment.otpauthUri}</code></details><CodeInput value={controller.code} onChange={controller.setCode} /><button disabled={controller.busy || !/^\d{6}$/.test(controller.code)} onClick={controller.confirm} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Verifica e attiva</button></div>}
    {controller.recoveryCodes.length > 0 && <div className="space-y-3"><p className="font-semibold text-emerald-700">MFA attivata. Questi codici verranno mostrati una sola volta.</p><ul className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-4 font-mono text-sm">{controller.recoveryCodes.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {!controller.enrollment && <CodeInput value={controller.code} onChange={controller.setCode} placeholder="Codice MFA corrente per disattivare" />}
    <button disabled={controller.busy} onClick={controller.disable} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Disattiva MFA usando il codice inserito</button>
    {controller.message && <p role="status" className="text-sm text-slate-700">{controller.message}</p>}
  </section></main>;
}

function CodeInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder={placeholder} className="w-full rounded-xl border border-slate-300 px-3 py-2" />; }
