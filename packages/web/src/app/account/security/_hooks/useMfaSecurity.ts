'use client';

/** Coordinates MFA state changes through the reusable user-mutation lifecycle. */

import { useState } from 'react';
import { beginMfaEnrollmentAction, confirmMfaEnrollmentAction, disableMfaAction } from '../../../actions/mfaActions';
import { useUserMutation } from '../../../mutations/useUserMutation';

export function useMfaSecurity() {
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const mutation = useUserMutation();

  const begin = () => void mutation.execute(async () => {
    const result = await beginMfaEnrollmentAction(code);
    if (!result.success || !result.data) throw result.error;
    setEnrollment(result.data);
  });
  const confirm = () => void mutation.execute(async () => {
    const result = await confirmMfaEnrollmentAction(code);
    if (!result.success || !result.data) throw result.error;
    setRecoveryCodes(result.data.recoveryCodes);
  });
  const disable = () => void mutation.execute(async () => {
    const result = await disableMfaAction(code);
    if (!result.success) throw result.error;
    setEnrollment(null); setRecoveryCodes([]); setCode('');
  });
  return { enrollment, code, setCode, recoveryCodes, failure: mutation.failure, retry: () => void mutation.retry(), busy: mutation.pending, begin, confirm, disable };
}
