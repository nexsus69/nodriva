'use client';

import { Alert } from '../components/ui/feedback';
import { PageShell } from '../components/ui/layout';
import { WorkspaceHeader, WorkspaceStats } from './WorkspaceHeader';
import { WorkspaceRootNodes } from './WorkspaceRootNodes';
import { useWorkspaceHub } from '../_hooks/useWorkspaceHub';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export function WorkspaceHubScreen() {
  const controller = useWorkspaceHub();
  const { t } = useAppLocale();
  return <PageShell className="space-y-8">
    <WorkspaceHeader />
    <WorkspaceStats checking={controller.checkingSeed} loading={controller.isLoading} seeded={controller.databaseSeeded} nodeCount={controller.nodes.length} />
    {!controller.checkingSeed && !controller.seedStatusError && !controller.databaseSeeded && <section className="space-y-4 rounded-2xl border border-amber-500/25 bg-amber-50 p-8 text-center"><span className="text-4xl block">🌱</span><h2 className="text-base font-semibold text-amber-900">{t('workspace.setupTitle')}</h2><p className="text-xs text-amber-700">{t('workspace.setupDescription')} <strong>INITIALIZE SYSTEM</strong>.</p><input value={controller.seedConfirmation} onChange={(event) => controller.setSeedConfirmation(event.target.value)} aria-label={t('workspace.setupConfirmation')} className="mx-auto w-full max-w-sm rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm" placeholder="INITIALIZE SYSTEM" /><button onClick={() => void controller.seedDatabase()} disabled={controller.seeding || controller.seedConfirmation !== 'INITIALIZE SYSTEM'} className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-semibold disabled:opacity-60">{controller.seeding ? t('workspace.initializing') : `🌱 ${t('workspace.initialize')}`}</button></section>}
    {controller.seedStatusError && <Alert tone="danger"><strong>{t('workspace.databaseCheckUnavailable')}</strong> {controller.seedStatusError.message} <button type="button" onClick={controller.retrySeedStatus} className="ml-2 font-semibold underline">{t('common.retry')}</button></Alert>}
    {(controller.seedError || controller.error) && <Alert tone="danger"><strong>{t('common.error')}</strong> {controller.seedError || controller.error?.message}</Alert>}
    <WorkspaceRootNodes nodes={controller.nodes} loading={controller.isLoading || controller.checkingSeed} />
  </PageShell>;
}
