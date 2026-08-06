'use client';

import { useState } from 'react';
import {
  beginMfaEnrollmentAction,
  confirmMfaEnrollmentAction,
  disableMfaAction,
} from '../../actions/mfaActions';

export default function AccountSecurityPage() {
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try { await operation(); } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sicurezza account</h1>
        <p className="mt-2 text-sm text-slate-600">Configura un autenticatore TOTP e conserva offline i codici di recupero.</p>
      </div>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!enrollment && recoveryCodes.length === 0 && (
          <button disabled={busy} onClick={() => run(async () => setEnrollment(await beginMfaEnrollmentAction(code)))} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Avvia configurazione MFA
          </button>
        )}
        {enrollment && recoveryCodes.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">Aggiungi manualmente questo segreto nell’app autenticatore:</p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-sm">{enrollment.secret}</code>
            <details className="text-xs text-slate-500"><summary>URI otpauth</summary><code className="mt-2 block break-all">{enrollment.otpauthUri}</code></details>
            <label className="block text-sm font-medium text-slate-700" htmlFor="totp-code">Codice a 6 cifre</label>
            <input id="totp-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            <button disabled={busy || !/^\d{6}$/.test(code)} onClick={() => run(async () => {
              const result = await confirmMfaEnrollmentAction(code);
              setRecoveryCodes(result.recoveryCodes);
            })} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Verifica e attiva</button>
          </div>
        )}
        {recoveryCodes.length > 0 && (
          <div className="space-y-3">
            <p className="font-semibold text-emerald-700">MFA attivata. Questi codici verranno mostrati una sola volta.</p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-4 font-mono text-sm">
              {recoveryCodes.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {!enrollment && (
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" placeholder="Codice MFA corrente per disattivare" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
        )}
        <button disabled={busy} onClick={() => run(async () => {
          await disableMfaAction(code); setEnrollment(null); setRecoveryCodes([]); setCode(''); setMessage('MFA disattivata.');
        })} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Disattiva MFA usando il codice inserito</button>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      </section>
    </main>
  );
}
