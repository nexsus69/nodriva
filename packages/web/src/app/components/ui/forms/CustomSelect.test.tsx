/** Verifies the shared custom select contract and native-control removal. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomSelect } from "./CustomSelect";

describe("CustomSelect", () => {
  it("renders an accessible combobox without a native select element", () => {
    const markup = renderToStaticMarkup(
      <CustomSelect
        id="role"
        value="admin"
        options={[{ value: "admin", label: "Administrator" }]}
        tone="light"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("Administrator");
    expect(markup).not.toContain("<select");
  });

  it("uses the accessible placeholder tone on light surfaces", () => {
    const markup = renderToStaticMarkup(
      <CustomSelect
        id="role"
        value=""
        options={[]}
        tone="light"
        placeholder="Choose a role"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain("text-slate-500");
  });
});
