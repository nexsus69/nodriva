/** Verifies that rejected user mutations become explicit resolved outcomes. */
import { describe, expect, it } from "vitest";
import { describeMutationFailure, runUserMutationAttempt, runUserMutationOperation } from "./useUserMutation";

const t = (key: string) => key;

describe("user mutation outcome", () => {
  it("converts a rejected user operation into a resolved, retryable infrastructure outcome", async () => {
    await expect(runUserMutationOperation(
      async () => { throw Object.assign(new Error("offline"), { code: "INTERNAL_ERROR", message: "offline" }); },
      t,
    )).resolves.toMatchObject({
      ok: false,
      failure: { kind: "infrastructure", retryable: true, message: "errors.internal" },
    });
  });

  it.each([
    ["VALIDATION_ERROR", "validation"],
    ["ACCESS_FORBIDDEN", "authorization"],
    ["LOCK_CONFLICT", "concurrency"],
    ["NOT_FOUND", "not-found"],
  ] as const)("classifies %s without an unsafe retry", (code, kind) => {
    expect(describeMutationFailure({ code, message: code }, t)).toMatchObject({ kind, retryable: false });
  });

  it("retains a structured API error for contextual failure presentation", () => {
    const error = {
      code: "RESOURCE_DELETE_RESTRICTED" as const,
      message: "restricted",
      totalReferencerCount: 2,
      referencers: [],
    };

    expect(describeMutationFailure(error, t).apiError).toMatchObject({
      code: "RESOURCE_DELETE_RESTRICTED",
      totalReferencerCount: 2,
    });
  });

  it("replays the completion callback when an infrastructure retry succeeds", async () => {
    let completed = 0;
    const operation = async () => "saved";
    const complete = (value: string) => {
      expect(value).toBe("saved");
      completed += 1;
    };

    await runUserMutationAttempt(operation, complete);
    await runUserMutationAttempt(operation, complete);

    expect(completed).toBe(2);
  });
});
