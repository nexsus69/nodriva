/** Defines the locales supported by the backend message contract. */
export const SUPPORTED_LOCALES = ["en", "it"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Normalizes a locale tag to one of the supported backend locales. */
export function normalizeLocale(
  value: string | null | undefined,
  fallback: SupportedLocale = "en",
): SupportedLocale {
  const language = value?.trim().toLowerCase().split(/[-_]/u)[0];
  return language === "it" ? "it" : language === "en" ? "en" : fallback;
}

/** Negotiates the first supported locale from an Accept-Language header. */
export function negotiateLocale(
  header: string | null | undefined,
  fallback: SupportedLocale = "en",
): SupportedLocale {
  if (!header) return fallback;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const weight = quality ? Number.parseFloat(quality.trim().slice(2)) : 1;
      return { tag: tag ?? "", weight: Number.isFinite(weight) ? weight : 0 };
    })
    .sort((left, right) => right.weight - left.weight);
  for (const candidate of candidates) {
    if (candidate.tag.trim() === "*" || candidate.weight === 0) continue;
    const language = candidate.tag.trim().toLowerCase().split(/[-_]/u)[0];
    if (language === "it") return "it";
    if (language === "en") return "en";
  }
  return fallback;
}

/** Describes a language-neutral message that can be rendered at an API boundary. */
export interface LocalizedMessage {
  key: string;
  params?: Readonly<Record<string, string | number | boolean>>;
}
