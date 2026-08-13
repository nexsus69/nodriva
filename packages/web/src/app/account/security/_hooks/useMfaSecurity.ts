'use client';

import { useState } from 'react';
import { beginMfaEnrollmentAction, confirmMfaEnrollmentAction, disableMfaAction } from '../../../actions/mfaActions';

export function useMfaSecurity() {
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await operation(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Operazione non riuscita.'); } finally { setBusy(false); }
  };
  const begin = () => void run(async () => setEnrollment(await beginMfaEnrollmentAction(code)));
  const confirm = () => void run(async () => setRecoveryCodes((await confirmMfaEnrollmentAction(code)).recoveryCodes));
  const disable = () => void run(async () => { await disableMfaAction(code); setEnrollment(null); setRecoveryCodes([]); setCode(''); setMessage('MFA disattivata.'); });
  return { enrollment, code, setCode, recoveryCodes, message, busy, begin, confirm, disable };
}
