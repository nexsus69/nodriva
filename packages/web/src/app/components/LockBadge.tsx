'use client';

import React from 'react';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
interface LockBadgeProps {
  lockedByOther: { locked: boolean; byUserId?: string };
  isMyLock: boolean;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  error: string | null;
}

export function LockBadge({ lockedByOther, isMyLock, acquireLock, releaseLock, error }: LockBadgeProps) {
  const { t } = useAppLocale();
  if (lockedByOther.locked) {
    return (
      <div className="flex items-center space-x-2 bg-red-100 text-red-800 px-3 py-1 rounded-md text-sm shadow-sm transition-all animate-pulse">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        <span>{t('lock.otherSession')}</span>
      </div>
    );
  }

  if (isMyLock) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-md text-sm shadow-sm flex items-center space-x-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <span>{t('lock.editMode')}</span>
        </div>
        <button 
          onClick={releaseLock}
          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
        >
          {t('lock.exitEdit')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button 
        onClick={acquireLock}
        className="flex items-center space-x-2 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md text-sm shadow-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
        <span>{t('lock.edit')}</span>
      </button>
      {error && <span className="text-red-500 text-xs mt-1">{error}</span>}
    </div>
  );
}
