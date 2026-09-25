/** Verifies preservation and explicit disposal of nested managed-enum drafts. */
import { describe, expect, it } from "vitest";
import {
  hasDirtyEnumOptionDraft,
  readEnumOptionDraft,
  removeEnumOptionDraft,
  updateEnumOptionDraft,
} from "./useManagedEnumOptionForm";

describe("managed enum option drafts", () => {
  it("preserves a typed draft when the nested modal closes and reopens", () => {
    const afterValue = updateEnumOptionDraft({}, "priority", "value", "high");
    const afterLabel = updateEnumOptionDraft(afterValue, "priority", "label", "High priority");

    expect(readEnumOptionDraft(afterLabel, "priority")).toEqual({
      value: "high",
      label: "High priority",
    });
    expect(hasDirtyEnumOptionDraft(afterLabel)).toBe(true);
  });

  it("removes only the explicitly discarded nested draft", () => {
    const drafts = {
      priority: { value: "high", label: "High priority" },
      status: { value: "open", label: "Open" },
    };

    expect(removeEnumOptionDraft(drafts, "priority")).toEqual({
      status: { value: "open", label: "Open" },
    });
  });
});
