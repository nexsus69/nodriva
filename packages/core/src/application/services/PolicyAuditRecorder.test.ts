/** Verifies that configurable audit evidence is filtered centrally and fails closed. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditPort } from "../ports/AuditPort.js";
import type { RuntimeConfigurationPort } from "../ports/RuntimeConfigurationPort.js";
import {
  AUDIT_LOCK_LIFECYCLE_SETTING,
  PolicyAuditRecorder,
  RuntimeAuditRecordingPolicy,
} from "./PolicyAuditRecorder.js";

const record = vi.fn(
  async (...args: Parameters<AuditPort["record"]>): Promise<void> => {
    void args;
  },
);

function createRecorder(settingValue: boolean | Error) {
  const configuration = {
    getSetting: vi.fn().mockImplementation(async () => {
      if (settingValue instanceof Error) throw settingValue;
      return settingValue;
    }),
  } as unknown as RuntimeConfigurationPort;
  return {
    configuration,
    recorder: new PolicyAuditRecorder(
      { record },
      new RuntimeAuditRecordingPolicy(configuration),
    ),
  };
}

describe("PolicyAuditRecorder", () => {
  beforeEach(() => {
    record.mockClear();
  });

  it("can suppress only ordinary lock lifecycle evidence through one runtime setting", async () => {
    const { recorder, configuration } = createRecorder(false);

    await recorder.record("user-1", "lock.acquire", "node", "node-1", "node-1", null, null);
    await recorder.record("user-1", "lock.release", "node", "node-1", "node-1", null, null);
    await recorder.record("user-1", "lock.conflict", "node", "node-1", "node-1", null, null);

    expect(configuration.getSetting).toHaveBeenCalledTimes(2);
    expect(configuration.getSetting).toHaveBeenCalledWith(AUDIT_LOCK_LIFECYCLE_SETTING, true);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenLastCalledWith("user-1", "lock.conflict", "node", "node-1", "node-1", null, null);
  });

  it("retains configurable evidence when the configuration read is unavailable", async () => {
    const { recorder } = createRecorder(new Error("configuration unavailable"));

    await recorder.record("user-1", "lock.acquire", "node", "node-1", "node-1", null, null);

    expect(record).toHaveBeenCalledTimes(1);
  });
});
