import { describe, expect, it } from "vitest";
import { negotiateLocale, normalizeLocale } from "./Locale.js";

describe("backend locale contract", () => {
  it("normalizes supported language tags and falls back safely", () => {
    expect(normalizeLocale("it-IT")).toBe("it");
    expect(normalizeLocale("en_US")).toBe("en");
    expect(normalizeLocale("fr-FR")).toBe("en");
  });

  it("negotiates the highest quality supported language", () => {
    expect(negotiateLocale("fr;q=0.9,it;q=0.8,en;q=0.7")).toBe("it");
    expect(negotiateLocale("de, en-US;q=0.8")).toBe("en");
    expect(negotiateLocale(undefined, "it")).toBe("it");
  });
});
