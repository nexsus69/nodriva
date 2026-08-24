/** Verifies normalization for reload-safe repeatable administrative rows. */
import { describe, expect, it } from "vitest";
import { normalizeAdminRepeatableRowIds } from "./useAdminRepeatableRows";

describe("normalizeAdminRepeatableRowIds", () => {
  it("restores unique persisted rows", () => {
    expect(normalizeAdminRepeatableRowIds(["1", "extra", "extra"], "1"))
      .toEqual(["1", "extra"]);
  });

  it("always preserves one initial row", () => {
    expect(normalizeAdminRepeatableRowIds([], "1")).toEqual(["1"]);
    expect(normalizeAdminRepeatableRowIds(undefined, "1")).toEqual(["1"]);
  });
});
