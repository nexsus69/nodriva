import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FormRenderer } from "./FormRenderer";
import { defineForm } from "./FormDefinition";

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

  it("marks every declared rule invalid while its value is empty", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[
          {
            name: "key",
            type: "text",
            label: "Key",
            validation: { pattern: "^[a-z]+$" },
          },
        ]}
        values={{ key: "" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain("✕");
    expect(markup).toContain("text-rose-400");
    expect(markup).not.toContain("○");
  });

  it("marks every rule invalid while a required field is empty", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[
          {
            name: "roleKey",
            type: "text",
            label: "Role key",
            required: true,
            validation: { pattern: "^[a-z0-9_]+$", minLength: 2 },
          },
        ]}
        values={{ roleKey: "" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect((markup.match(/✕/g) ?? []).length).toBe(3);
    expect(markup).not.toContain("○");
  });

  it("rejects legacy required declarations inside validation", () => {
    expect(() =>
      defineForm({
        key: "invalid",
        version: "1",
        fields: [
          {
            name: "value",
            type: "text",
            label: "Value",
            required: true,
            validation: { required: true } as never,
          },
        ],
      }),
    ).toThrow("must declare required on the field itself");
  });

  it("renders relation fields through the shared relation control", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[{
          name: "owner",
          type: "relation",
          label: "Owner",
          required: true,
          resourceType: "entity",
          typeKey: "user",
        }]}
        values={{ owner: "" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain('id="relation-search-owner"');
    expect(markup).toContain('required=""');
    expect(markup.match(/Owner/g)?.length).toBe(1);
  });
});
