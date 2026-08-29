/** Verifies the semantic dependency matching used by admin realtime collections. */
import { describe, expect, it } from "vitest";
import { matchesAdminRealtimeInvalidation } from "./useAdminRealtimeCollectionRefresh";

describe("matchesAdminRealtimeInvalidation", () => {
  it("refreshes only collections whose semantic dependency was invalidated", () => {
    expect(matchesAdminRealtimeInvalidation(["audit"], ["roles", "role"])).toBe(false);
    expect(matchesAdminRealtimeInvalidation(["roles", "role"], ["role:operator"])).toBe(true);
    expect(matchesAdminRealtimeInvalidation(["deleted-nodes", "deleted-entities"], ["deleted-entities"])).toBe(true);
  });
});
