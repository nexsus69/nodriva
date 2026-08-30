/** Localizes stable administrative catalog values while preserving technical identifiers. */
import type {
  FieldDataType,
  PermissionDto,
  RuntimeCapabilityDto,
  SystemSettingDto,
} from "@dashboard/core";
import type { FormOption } from "@/app/components/ui/forms";

export type AdminTranslate = (key: string, fallback?: string) => string;

export interface AdminSemanticCatalogEntry {
  label: string;
  description: string;
  keywords: readonly string[];
}

type CatalogKind = "fieldDataType" | "capability" | "setting" | "permission";

/** Resolves known catalog values locally and leaves historical values readable. */
function catalogEntry(
  kind: CatalogKind,
  value: string,
  fallback: Pick<AdminSemanticCatalogEntry, "label" | "description">,
  t: AdminTranslate,
): AdminSemanticCatalogEntry {
  const key = `admin.catalog.${kind}.${value}`;
  return {
    label: t(key, fallback.label),
    description: t(`${key}.description`, fallback.description),
    keywords: [value, fallback.label],
  };
}

/** Presents a finite field-data-type catalog without exposing its value as its label. */
export function fieldDataTypeOption(
  value: FieldDataType,
  t: AdminTranslate,
): FormOption {
  return {
    value,
    ...catalogEntry(
      "fieldDataType",
      value,
      { label: value, description: t("admin.catalog.technicalValue").replace("{value}", value) },
      t,
    ),
  };
}

/** Presents an installed capability through its stable key and localized catalogue entry. */
export function runtimeCapabilitySemanticEntry(
  capability: RuntimeCapabilityDto,
  t: AdminTranslate,
): AdminSemanticCatalogEntry {
  return catalogEntry(
    "capability",
    capability.capabilityKey,
    { label: capability.name, description: capability.description },
    t,
  );
}

/** Presents a runtime setting through its stable key and localized catalogue entry. */
export function systemSettingSemanticEntry(
  setting: SystemSettingDto,
  t: AdminTranslate,
): AdminSemanticCatalogEntry {
  return catalogEntry(
    "setting",
    setting.settingKey,
    { label: setting.displayName, description: setting.description },
    t,
  );
}

/** Turns a permission key into a human label while retaining a localized technical fallback. */
export function permissionSemanticEntry(
  permission: PermissionDto,
  t: AdminTranslate,
): AdminSemanticCatalogEntry {
  const words = permission.permissionKey
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => t(`admin.catalog.word.${word}`, word));
  return catalogEntry(
    "permission",
    permission.permissionKey,
    {
      label: words.join(" · ") || permission.name,
      description: t("admin.catalog.technicalValue").replace("{value}", permission.permissionKey),
    },
    t,
  );
}
