/** Verifies the shared meaning of an optional administrative refresh. */
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invalidate: vi.fn() }));

vi.mock("@/app/cache/GlobalCacheClient", () => ({
  AppCache: { admin: { invalidate: mocks.invalidate } },
}));

import { refreshAdminCollection } from "./refreshAdminCollection";

describe("refreshAdminCollection", () => {
  it("invalidates administrative reads before reloading the authoritative projection", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);

    await refreshAdminCollection(reload);

    expect(mocks.invalidate).toHaveBeenCalledWith();
    expect(reload).toHaveBeenCalledOnce();
    expect(mocks.invalidate.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]!);
  });
});
