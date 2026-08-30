import { describe, expect, it } from "vitest";
import { formatAdminDateTime, formatAdminTechnicalIdentifier } from "./adminFormatters";

describe("admin formatters", () => {
  it("formats valid timestamps in the requested locale", () => {
    expect(formatAdminDateTime("2026-08-30T16:24:35.719Z", "it")).toBe("30/08/2026, 18:24:35");
    expect(formatAdminDateTime("2026-08-30T16:24:35.719Z", "en")).toBe("30/08/2026, 18:24:35");
  });

  it("preserves invalid timestamps for diagnostics", () => {
    expect(formatAdminDateTime("not-a-date", "it")).toBe("not-a-date");
  });

  it("shortens long technical identifiers while preserving both ends", () => {
    expect(formatAdminTechnicalIdentifier("1461408b-5d7c-455c-9253-a2606498e295")).toBe("1461408b…a2606498e295");
    expect(formatAdminTechnicalIdentifier("short-id")).toBe("short-id");
  });
});
