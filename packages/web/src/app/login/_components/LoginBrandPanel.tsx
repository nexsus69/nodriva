'use client';

import { useAppLocale } from '@/app/i18n/AppLocaleStore';

/** Presents the Nodriva identity and value proposition on the login page. */
export function LoginBrandPanel() {
  const { t } = useAppLocale();
  return <section className="relative hidden min-h-[680px] flex-col justify-between overflow-hidden border-r border-indigo-400/20 bg-gradient-to-br from-indigo-500 via-indigo-600 to-[#312e81] p-10 lg:flex xl:p-14">
    <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[36px] border-white/15" />
    <div aria-hidden="true" className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[44px] border-violet-200/15" />
    <div className="relative"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><span className="text-xl font-bold text-white">N</span></div><span className="text-sm font-semibold tracking-[0.18em] text-indigo-100">NODRIVA</span></div><div className="mt-28 max-w-md"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200">{t('login.brandEyebrow')}</p><h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white xl:text-5xl">{t('login.brandTitle')}</h1><p className="mt-6 max-w-sm text-base leading-7 text-indigo-100/75">{t('login.brandDescription')}</p></div></div>
    <div className="relative grid grid-cols-3 gap-3 border-t border-white/15 pt-6 text-xs text-indigo-100/70"><div><p className="mb-1 text-lg font-semibold text-white">01</p><p>{t('login.brandControl')}</p></div><div><p className="mb-1 text-lg font-semibold text-white">02</p><p>{t('login.brandCollaboration')}</p></div><div><p className="mb-1 text-lg font-semibold text-white">03</p><p>{t('login.brandGovernance')}</p></div></div>
  </section>;
}
