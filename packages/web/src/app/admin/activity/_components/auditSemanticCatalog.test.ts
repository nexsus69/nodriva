import { describe, expect, it } from "vitest";
import { APP_MESSAGES } from "@/app/i18n/AppLocaleStore";
import { auditResourceLabel } from "./auditSemanticCatalog";

function translate(locale: "en" | "it") {
  return (key: string, fallback = key) => APP_MESSAGES[locale][key] ?? fallback;
}

describe("audit resource labels", () => {
  it("localizes a technical system-setting key centrally", () => {
    expect(auditResourceLabel("system_setting", "session.idleTimeoutSeconds", translate("it")))
      .toBe("Timeout di inattività sessione");
    expect(auditResourceLabel("system_setting", "session.idleTimeoutSeconds", translate("en")))
      .toBe("Session inactivity timeout");
  });

  it("preserves dynamic labels and falls back to the resource catalogue", () => {
    expect(auditResourceLabel("placement_policy", "Operations policy", translate("it")))
      .toBe("Operations policy");
    expect(auditResourceLabel("system_setting", "legacy.unknown", translate("it")))
      .toBe("legacy.unknown");
    expect(auditResourceLabel("node", null, translate("it"))).toBe("Nodo");
  });
});
