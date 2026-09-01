"use client";

/** Presents scoped, authorized service operations without editing deployment or secrets. */
import { useEffect, useMemo, useState } from "react";
import type { PublicBackupStatus, PublicServiceConfiguration, ServiceHealthCheckResult } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { Alert, StatusBadge } from "@/app/components/ui/feedback";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import {
  providerLabel,
  serviceLabelKey,
  servicePresentationStatus,
  servicesForScope,
  serviceStatusTone,
  type ServiceOperationsScope,
} from "./serviceOperationsModel";

type ServiceRow = PublicServiceConfiguration & { id: string };

const SCOPE_CONTENT: Record<ServiceOperationsScope, { moduleKey: string; titleKey: string; descriptionKey: string; emptyKey: string; loadingKey: string }> = {
  integrations: { moduleKey: "platform.integrations", titleKey: "admin.integrations", descriptionKey: "admin.integrationsDescription", emptyKey: "admin.noIntegrations", loadingKey: "admin.loadingIntegrations" },
  recovery: { moduleKey: "platform.data-recovery", titleKey: "admin.dataRecovery", descriptionKey: "admin.dataRecoveryDescription", emptyKey: "admin.noDataRecoveryServices", loadingKey: "admin.loadingDataRecovery" },
  health: { moduleKey: "platform.health", titleKey: "admin.healthObservability", descriptionKey: "admin.healthObservabilityDescription", emptyKey: "admin.noHealthServices", loadingKey: "admin.loadingHealth" },
};

function statusLabel(status: ReturnType<typeof servicePresentationStatus>, t: (key: string) => string): string {
  return t(`admin.serviceStatus.${status}`);
}

function backupStatusTone(status: PublicBackupStatus['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'paused') return 'neutral';
  return 'warning';
}

/** Uses one resource lifecycle for integrations, recovery evidence, and service health. */
export function ServiceIntegrationsModuleScreen({ scope = 'integrations' }: { scope?: ServiceOperationsScope }) {
  const { t } = useAppLocale();
  const [health, setHealth] = useState<Record<string, ServiceHealthCheckResult>>({});
  const [healthFailures, setHealthFailures] = useState<ReadonlySet<string>>(() => new Set());
  const [backupStatus, setBackupStatus] = useState<PublicBackupStatus | null>(null);
  const [backupStatusError, setBackupStatusError] = useState<string | null>(null);
  const content = SCOPE_CONTENT[scope];

  useEffect(() => {
    if (scope !== 'recovery') return undefined;
    let cancelled = false;
    void AppCache.admin.getBackupStatus().then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setBackupStatus(result.data);
        setBackupStatusError(null);
      } else {
        setBackupStatus(null);
        setBackupStatusError(result.error?.message ?? t('admin.backupStatusUnavailable'));
      }
    });
    return () => { cancelled = true; };
  }, [scope, t]);

  const resource = useMemo(() => defineAdminResource<ServiceRow>({
    key: `service-operations-${scope}`,
    moduleKey: content.moduleKey,
    label: t(content.titleKey),
    description: t(content.descriptionKey),
    permissions: { read: ["system.config.read"] },
    list: {
      realtimeDependencies: ["service-configurations"],
      load: async () => {
        const result = await AppCache.admin.listServiceConfigurations();
        if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loadingIntegrations"));
        return servicesForScope(result.data, scope).map((service) => ({ ...service, id: service.serviceKey }));
      },
      columns: [
        { key: "service", label: t("admin.name"), render: (row) => <div><p className="font-medium text-slate-900">{t(serviceLabelKey(row.serviceKey))}</p><p className="mt-0.5 text-xs text-slate-500">{t(`admin.serviceFallback.${row.fallback}`)}</p></div>, sortValue: (row) => t(serviceLabelKey(row.serviceKey)) },
        { key: "provider", label: t("admin.provider"), render: (row) => providerLabel(row.providerKey, t), sortValue: (row) => providerLabel(row.providerKey, t) },
        { key: "availability", label: t("admin.availability"), render: (row) => {
          const status = healthFailures.has(row.id) ? 'unavailable' : servicePresentationStatus(row, health[row.id]);
          return <StatusBadge tone={serviceStatusTone(status)}>{statusLabel(status, t)}</StatusBadge>;
        }, sortValue: (row) => healthFailures.has(row.id) ? 'unavailable' : servicePresentationStatus(row, health[row.id]) },
        { key: "dependencies", label: t("admin.dependencies"), render: (row) => row.dependencies.length === 0 ? t("admin.none") : row.dependencies.map((dependency) => t(serviceLabelKey(dependency))).join(", ") },
        { key: "reload", label: t("admin.reload"), render: (row) => t(`admin.serviceReload.${row.reload}`) },
      ],
      emptyLabel: t(content.emptyKey),
      loadingLabel: t(content.loadingKey),
    },
  }), [content, health, healthFailures, scope, t]);
  const controller = useAdminResourceController(resource, undefined);

  const definition: AdminCollectionDefinition<ServiceRow> = {
    title: resource.label,
    description: resource.description,
    icon: "settings",
    columns: resource.list.columns,
    actions: scope === 'recovery' ? [] : [{
      key: "health",
      label: t("admin.checkHealth"),
      icon: "activity",
      onClick: (row) => {
        void AppCache.admin.checkServiceHealth(row.serviceKey).then((result) => {
          if (result.success && result.data) {
            setHealth((current) => ({ ...current, [row.id]: result.data! }));
            setHealthFailures((current) => {
              const next = new Set(current);
              next.delete(row.id);
              return next;
            });
          } else {
            setHealthFailures((current) => new Set(current).add(row.id));
          }
        });
      },
    }],
    emptyLabel: resource.list.emptyLabel,
    loadingLabel: resource.list.loadingLabel,
    error: controller.error,
    loading: controller.loading,
    rows: controller.rows,
    onRefresh: controller.refresh,
    refreshLabel: t("admin.refresh"),
    actionMenuLabel: t("admin.actions"),
    rowLabel: (row) => row.serviceKey,
    pagination: { mode: "client", stateKey: `admin.${content.moduleKey}` },
    ...(scope === 'recovery' ? {
      filterPanel: <section className="border border-slate-200 bg-slate-50 p-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-slate-900">{t('admin.backupVerification')}</p><p className="mt-1 text-xs text-slate-600">{t('admin.backupVerificationDescription')}</p></div>
          {backupStatus ? <StatusBadge tone={backupStatusTone(backupStatus.status)}>{t(`admin.backupStatus.${backupStatus.status}`)}</StatusBadge> : <StatusBadge tone="warning">{t('admin.backupStatus.unavailable')}</StatusBadge>}
        </div>
        {backupStatus?.completedAt && <p className="mt-3 text-xs text-slate-600">{t('admin.backupCompletedAt')}: {new Date(backupStatus.completedAt).toLocaleString()}</p>}
        {backupStatus?.restoreVerification && <p className="mt-1 text-xs text-slate-600">{t('admin.restoreVerification')}: {t(`admin.restoreVerificationStatus.${backupStatus.restoreVerification}`)}</p>}
        {backupStatusError && <Alert tone="warning" className="mt-3">{t('admin.backupStatusUnavailable')}</Alert>}
      </section>,
    } : {}),
  };

  return <AdminCollectionScreen definition={definition} />;
}
