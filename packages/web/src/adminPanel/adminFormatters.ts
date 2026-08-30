import type { SupportedLocale } from "@dashboard/core";

/** Formats persisted ISO timestamps for the active application locale. */
export function formatAdminDateTime(value: string, locale: SupportedLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Keeps technical identifiers recognizable without letting them dominate the UI. */
export function formatAdminTechnicalIdentifier(value: string): string {
  if (value.length <= 24) return value;
  return `${value.slice(0, 8)}…${value.slice(-12)}`;
}
