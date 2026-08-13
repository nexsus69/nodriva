'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { loginAction } from '../../actions/authActions';
import { AppCache } from '../../cache/GlobalCacheClient';

export function useLogin() {
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { update: refreshSession } = useSession();

  useEffect(() => { AppCache.purgeAll(); }, []);

  const submit = async (formData: FormData) => {
    if (isLoading) return;
    setError(''); setIsLoading(true);
    try {
      const result = await loginAction(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''), String(formData.get('mfaCode') ?? ''));
      if (!result.success) { setError(result.error || 'Errore durante il login'); setIsLoading(false); return; }
      AppCache.purgeAll();
      try { await refreshSession(); } catch (reason) { console.warn('Session refresh after login failed; using server render:', reason); }
      router.replace('/'); router.refresh();
    } catch (reason) {
      console.error('Login exception:', reason);
      setError('Errore di connessione o errore interno'); setIsLoading(false);
    }
  };

  return { error, password, setPassword, isLoading, submit };
}
