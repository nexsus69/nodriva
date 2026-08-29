/** Verifies that the overview flags only actionable configuration gaps. */
import { describe, expect, it } from "vitest";
import { requiredCapabilityGaps, summarizeAdminOverview } from "./adminOverviewModel";

describe("admin overview model", () => {
  it("does not turn optional capabilities into false alerts", () => {
    const capabilities = [
      { capabilityKey: "backup", defaultStatus: "enabled", currentStatus: "disabled" },
      { capabilityKey: "antivirus", defaultStatus: "optional", currentStatus: "disabled" },
      { capabilityKey: "realtime", defaultStatus: "enabled", currentStatus: "enabled" },
    ] as never[];

    expect(requiredCapabilityGaps(capabilities).map((capability) => capability.capabilityKey)).toEqual(["backup"]);
  });

  it("keeps the summary limited to current, actionable information", () => {
    const summary = summarizeAdminOverview({
      capabilities: [
        { defaultStatus: "enabled", currentStatus: "enabled" },
        { defaultStatus: "optional", currentStatus: "disabled" },
      ] as never[],
      workflows: [{ isActive: true }, { isActive: false }] as never[],
      nodeTypes: [{ isActive: true }, { isActive: false }] as never[],
      entityTypes: [{ isActive: true }] as never[],
      auditRecords: Array.from({ length: 6 }, (_, index) => ({ id: String(index) })) as never[],
    });

    expect(summary).toMatchObject({
      requiredCapabilityGaps: [],
      enabledCapabilityCount: 1,
      activeWorkflowCount: 1,
      activeNodeTypeCount: 1,
      activeEntityTypeCount: 1,
    });
    expect(summary.recentAuditRecords).toHaveLength(5);
  });
});
