import { describe, expect, it } from "vitest";
import { buildFieldDefinition } from "./typeDetailModel";

describe("buildFieldDefinition", () => {
  const translate = (key: string) => key;

  it("does not expose relation or enum controls for scalar fields", () => {
    const names = buildFieldDefinition(translate, { dataType: "string" }).fields.map((field) => field.name);
    expect(names).not.toContain("relationTargetDomain");
    expect(names).not.toContain("relationTargetIsUnique");
    expect(names).not.toContain("enumMode");
    expect(names).toContain("isRequired");
  });

  it("keeps relation controls only for relation fields", () => {
    const names = buildFieldDefinition(translate, { dataType: "relation" }).fields.map((field) => field.name);
    expect(names).toContain("relationTargetDomain");
    expect(names).toContain("relationTargetIsUnique");
    expect(names).not.toContain("enumMode");
  });

  it("keeps enum mode only for enum fields", () => {
    const names = buildFieldDefinition(translate, { dataType: "enum" }).fields.map((field) => field.name);
    expect(names).toContain("enumMode");
    expect(names).not.toContain("relationTargetDomain");
  });
});
