/** Translates generic audit identifiers into searchable, localized administration choices. */
import type { FormOption } from "@/app/components/ui/forms";

type Translate = (key: string, fallback?: string) => string;

/** Builds a semantic option while preserving the technical identifier for submission and support. */
export function auditSemanticOption(
  value: string,
  kind: "action" | "resource",
  t: Translate,
): FormOption {
  const specificKey = `admin.catalog.${kind}.${value}`;
  const specific = t(specificKey, "");
  const fallback = value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => t(`admin.catalog.word.${part}`, title(part)))
    .join(" · ");
  return {
    value,
    label: specific || fallback || value,
    description: t("admin.catalog.technicalValue", "Technical value: {value}").replace("{value}", value),
    keywords: [value, fallback],
  };
}

/** Resolves an audit subject label once for every audit surface. */
export function auditResourceLabel(
  resourceKind: string,
  resourceLabel: string | null | undefined,
  t: Translate,
): string {
  const fallback = auditSemanticOption(resourceKind, "resource", t).label;
  const value = resourceLabel?.trim();
  if (!value) return fallback;

  const catalogKind = resourceKind === "system_setting"
    ? "setting"
    : resourceKind === "runtime_capability"
      ? "capability"
      : null;
  if (!catalogKind) return value;

  return t(`admin.catalog.${catalogKind}.${value}`, value);
}

/** Uses a readable fallback for future modules whose vocabulary has not yet been localized. */
function title(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}
