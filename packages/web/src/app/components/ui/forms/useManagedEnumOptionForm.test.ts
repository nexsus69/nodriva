/** Verifies dirty detection and disposal of nested managed-enum drafts. */
import { describe, expect, it } from "vitest";
import {
  hasDirtyEnumOptionDraft,
  hasDirtyEnumOptionValues,
  readEnumOptionDraft,
  removeEnumOptionDraft,
  updateEnumOptionDraft,
} from "./useManagedEnumOptionForm";

describe("managed enum option drafts", () => {
  it("identifies the active nested draft that requires the common discard confirmation", () => {
    const afterValue = updateEnumOptionDraft({}, "priority", "value", "high");
    const afterLabel = updateEnumOptionDraft(afterValue, "priority", "label", "High priority");

    expect(readEnumOptionDraft(afterLabel, "priority")).toEqual({
      value: "high",
      label: "High priority",
    });
    expect(hasDirtyEnumOptionDraft(afterLabel)).toBe(true);
    expect(hasDirtyEnumOptionValues(afterLabel.priority)).toBe(true);
    expect(hasDirtyEnumOptionValues({ value: "", label: "" })).toBe(false);
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
