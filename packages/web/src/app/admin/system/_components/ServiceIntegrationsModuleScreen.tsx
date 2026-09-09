"use client";

/** Presents scoped, authorized service operations without editing deployment or secrets. */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { PublicBackupStatus, PublicServiceConfiguration, ServiceHealthCheckResult } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { Alert, StatusBadge } from "@/app/components/ui/feedback";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import type { AdminTableColumn } from "@/adminPanel/components/AdminTable";
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
type ServiceHealthState = {
  health: Record<string, ServiceHealthCheckResult>;
  healthFailures: ReadonlySet<string>;
};

class ServiceHealthStateStore {
  private snapshot: ServiceHealthState = { health: {}, healthFailures: new Set() };
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  recordSuccess(serviceId: string, result: ServiceHealthCheckResult): void {
    const healthFailures = new Set(this.snapshot.healthFailures);
    healthFailures.delete(serviceId);
    this.update({ health: { ...this.snapshot.health, [serviceId]: result }, healthFailures });
  }

  recordFailure(serviceId: string): void {
    this.update({ health: this.snapshot.health, healthFailures: new Set(this.snapshot.healthFailures).add(serviceId) });
  }

  private update(snapshot: ServiceHealthState): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}

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

/**
 * Columns read the latest health state without changing the resource definition.
 * Recreating that definition would recreate its controller and reload the list.
 */
export function createServiceOperationsColumns(
  t: (key: string) => string,
  getHealthState: () => ServiceHealthState,
): readonly AdminTableColumn<ServiceRow>[] {
  const presentationStatus = (row: ServiceRow) => {
    const { health, healthFailures } = getHealthState();
    return healthFailures.has(row.id) ? 'unavailable' : servicePresentationStatus(row, health[row.id]);
  };

  return [
    { key: "service", label: t("admin.name"), render: (row) => <div><p className="font-medium text-slate-900">{t(serviceLabelKey(row.serviceKey))}</p><p className="mt-0.5 text-xs text-slate-500">{t(`admin.serviceFallback.${row.fallback}`)}</p></div>, sortValue: (row) => t(serviceLabelKey(row.serviceKey)) },
    { key: "provider", label: t("admin.provider"), render: (row) => providerLabel(row.providerKey, t), sortValue: (row) => providerLabel(row.providerKey, t) },
    { key: "availability", label: t("admin.availability"), render: (row) => {
      const status = presentationStatus(row);
      return <StatusBadge tone={serviceStatusTone(status)}>{statusLabel(status, t)}</StatusBadge>;
    }, sortValue: presentationStatus },
    { key: "dependencies", label: t("admin.dependencies"), render: (row) => row.dependencies.length === 0 ? t("admin.none") : row.dependencies.map((dependency) => t(serviceLabelKey(dependency))).join(", ") },
    { key: "reload", label: t("admin.reload"), render: (row) => t(`admin.serviceReload.${row.reload}`) },
  ];
}

/** Uses one resource lifecycle for integrations, recovery evidence, and service health. */
export function ServiceIntegrationsModuleScreen({ scope = 'integrations' }: { scope?: ServiceOperationsScope }) {
  const { t } = useAppLocale();
  const healthStore = useMemo(() => new ServiceHealthStateStore(), []);
  useSyncExternalStore(healthStore.subscribe, healthStore.getSnapshot, healthStore.getSnapshot);
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
      columns: createServiceOperationsColumns(t, healthStore.getSnapshot),
      emptyLabel: t(content.emptyKey),
      loadingLabel: t(content.loadingKey),
    },
  }), [content, healthStore, scope, t]);
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
            healthStore.recordSuccess(row.id, result.data);
          } else {
            healthStore.recordFailure(row.id);
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
