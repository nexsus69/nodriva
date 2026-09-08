/** Verifies that configurable audit evidence is filtered centrally and fails closed. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditPort } from "../ports/AuditPort.js";
import type { AuditCollectionInvalidationPort } from "../ports/AuditCollectionInvalidationPort.js";
import type { RuntimeConfigurationPort } from "../ports/RuntimeConfigurationPort.js";
import type { TransactionPort } from "../ports/TransactionPort.js";
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
const invalidatePersistedAudit = vi.fn(async () => undefined);
const transactions: TransactionPort = {
  runInTransaction: vi.fn(async <T>(work: () => Promise<T>) => work()),
  runInAuthorizationMutation: vi.fn(async <T>(work: () => Promise<T>) => work()),
};

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
      transactions,
      { invalidatePersistedAudit } satisfies AuditCollectionInvalidationPort,
    ),
  };
}

describe("PolicyAuditRecorder", () => {
  beforeEach(() => {
    record.mockReset().mockResolvedValue(undefined);
    invalidatePersistedAudit.mockReset().mockResolvedValue(undefined);
    vi.mocked(transactions.runInTransaction).mockClear();
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
    expect(invalidatePersistedAudit).toHaveBeenCalledOnce();
  });

  it("retains configurable evidence when the configuration read is unavailable", async () => {
    const { recorder } = createRecorder(new Error("configuration unavailable"));

    await recorder.record("user-1", "lock.acquire", "node", "node-1", "node-1", null, null);

    expect(record).toHaveBeenCalledTimes(1);
    expect(invalidatePersistedAudit).toHaveBeenCalledWith({ actorUserId: "user-1", resourceKind: "node", resourceId: "node-1" });
  });

  it("persists the optional human-readable resource label", async () => {
    const { recorder } = createRecorder(true);

    await recorder.record("user-1", "system.update_setting", "system_setting", "setting-1", null, null, { value: "on" }, "Impostazioni audit");

    expect(record).toHaveBeenCalledWith("user-1", "system.update_setting", "system_setting", "setting-1", null, null, { value: "on" }, "Impostazioni audit");
  });

  it("does not invalidate when audit persistence fails", async () => {
    const { recorder } = createRecorder(true);
    record.mockRejectedValueOnce(new Error("audit write failed"));

    await expect(recorder.record("user-1", "node.update", "node", "node-1", "node-1", null, null))
      .rejects.toThrow("audit write failed");

    expect(invalidatePersistedAudit).not.toHaveBeenCalled();
  });
});
