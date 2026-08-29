import { describe, expect, it } from "vitest";
import { toAuditFilterQuery } from "./auditFilterModel";

describe("toAuditFilterQuery", () => {
  it("omits blank form controls while preserving remote pagination", () => {
    expect(toAuditFilterQuery({ actorUserId: "", actionKey: "entity.update", resourceKind: "entity", fromDate: "", toDate: "2026-08-29" }, 2, 25)).toEqual({
      actorUserId: undefined,
      actionKey: "entity.update",
      resourceKind: "entity",
      fromDate: undefined,
      toDate: "2026-08-29",
      page: 2,
      pageSize: 25,
    });
  });
});
