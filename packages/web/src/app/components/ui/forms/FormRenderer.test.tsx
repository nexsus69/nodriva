import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FormRenderer } from "./FormRenderer";

describe("FormRenderer", () => {
  it("renders schema-driven text and boolean fields", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[
          { name: "email", type: "email", label: "Email", required: true },
          { name: "isAdmin", type: "boolean", label: "Admin" },
        ]}
        values={{ email: "user@example.com", isAdmin: true }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain("Email");
    expect(markup).toContain("user@example.com");
    expect(markup).toContain("Admin");
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("checked");
    expect(markup).toContain('for="form-field-email"');
    expect(markup).toContain('id="form-field-email"');
    expect(markup).toContain('for="form-field-isAdmin"');
    expect(markup).toContain('id="form-field-isAdmin"');
  });

  it("renders custom children and pending submit state", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[]}
        values={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isPending
        pendingLabel="Creazione..."
      >
        <div>Ambiti iniziali</div>
      </FormRenderer>,
    );

    expect(markup).toContain("Ambiti iniziali");
    expect(markup).toContain("Creazione...");
    expect(markup).toContain("disabled");
  });

  it("can disable submission while prerequisite data is unavailable", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[]}
        values={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitDisabled
      />,
    );

    expect(markup).toContain("disabled");
    expect(markup).toContain("Salva");
  });

  it("renders definition sections and places fields on the same row", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        definition={{
          key: "sample",
          version: "1",
          layout: { columns: 2 },
          sections: [
            {
              key: "identity",
              label: "Identity",
              fieldNames: ["firstName", "lastName"],
              columns: 2,
            },
          ],
          fields: [
            {
              name: "firstName",
              type: "text",
              label: "First name",
              layout: { row: "identity", colSpan: 1, order: 1 },
            },
            {
              name: "lastName",
              type: "text",
              label: "Last name",
              layout: { row: "identity", colSpan: 1, order: 2 },
            },
          ],
        }}
        values={{ firstName: "", lastName: "" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain("Identity");
    expect(markup).toContain("grid-cols-2");
    expect(markup).toContain("col-span-1");
  });

  it("renders a validation symbol whenever a field has a rule", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[
          {
            name: "key",
            type: "text",
            label: "Key",
            validation: { pattern: "^[a-z]+$" },
          },
          { name: "required", type: "text", label: "Required", required: true },
        ]}
        values={{ key: "Invalid!", required: "" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        cancelLabel="Cancel"
      />,
    );

    expect(markup).toContain("✕");
    expect(markup).toContain("Cancel");
  });
});
