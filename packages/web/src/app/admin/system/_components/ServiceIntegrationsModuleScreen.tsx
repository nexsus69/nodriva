"use client";

/** Presents the authorized, redacted service catalogue without editing deployment or secrets. */
import { useMemo, useState } from "react";
import type { PublicServiceConfiguration, ServiceHealthCheckResult } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";

type ServiceRow = PublicServiceConfiguration & { id: string };

function statusLabel(value: ServiceRow["availability"] | ServiceHealthCheckResult["status"]): string {
  return value.replaceAll("-", " ");
}

/** Uses the common resource lifecycle while keeping health probes explicitly non-mutating. */
export function ServiceIntegrationsModuleScreen() {
  const { t } = useAppLocale();
  const [health, setHealth] = useState<Record<string, ServiceHealthCheckResult>>({});
  const resource = useMemo(() => defineAdminResource<ServiceRow>({
    key: "service-integrations",
    moduleKey: "platform.integrations",
    label: t("admin.integrations"),
    description: t("admin.integrationsDescription"),
    permissions: { read: ["system.config.read"] },
    list: {
      realtimeDependencies: ["service-configurations"],
      load: async () => {
        const result = await AppCache.admin.listServiceConfigurations();
        if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loadingIntegrations"));
        return result.data.map((service) => ({ ...service, id: service.serviceKey }));
      },
      columns: [
        { key: "service", label: t("admin.name"), render: (row) => row.serviceKey },
        { key: "provider", label: t("admin.provider"), render: (row) => row.providerKey },
        { key: "availability", label: t("admin.availability"), render: (row) => statusLabel(health[row.id]?.status ?? row.availability) },
        { key: "reload", label: t("admin.reload"), render: (row) => row.reload.replaceAll("-", " ") },
      ],
      emptyLabel: t("admin.noIntegrations"),
      loadingLabel: t("admin.loadingIntegrations"),
    },
  }), [health, t]);
  const controller = useAdminResourceController(resource, undefined);

  const definition: AdminCollectionDefinition<ServiceRow> = {
    title: resource.label,
    description: resource.description,
    icon: "settings",
    columns: resource.list.columns,
    actions: [{
      key: "health",
      label: t("admin.checkHealth"),
      icon: "activity",
      onClick: (row) => {
        void AppCache.admin.checkServiceHealth(row.serviceKey).then((result) => {
          if (result.success && result.data) setHealth((current) => ({ ...current, [row.id]: result.data! }));
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
    pagination: { mode: "client", stateKey: "admin.platform.integrations" },
  };

  return <AdminCollectionScreen definition={definition} />;
}
