/** Verifies the shared form renderer and its validation presentation. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FormRenderer } from "./FormRenderer";
import { defineForm } from "./FormDefinition";

describe("FormRenderer", () => {
  it("uses a readable placeholder tone for light form controls", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[{ name: "title", type: "text", label: "Title" }]}
        values={{ title: "" }}
        onChange={vi.fn()}
        theme="light"
      />,
    );

    expect(markup).toContain("placeholder:text-slate-500");
  });

  it("localizes shared validation fallbacks through the active locale", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[{ name: "title", type: "text", label: "Title", required: true }]}
        values={{ title: "" }}
        onChange={vi.fn()}
      />,
    );

    expect(markup).toContain("Questo valore è obbligatorio.");
    expect(markup).not.toContain(">Required<");
  });

  it("renders a controller-owned mutation error at the form boundary", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[]}
        values={{}}
        onChange={vi.fn()}
        error="The password could not be saved."
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("The password could not be saved.");
  });

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
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('for="form-field-email"');
    expect(markup).toContain('id="form-field-email"');
    expect(markup).toContain('aria-label="Admin"');
  });

  it("renders boolean descriptions and preserves read-only state", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[
          {
            name: "permission:read",
            type: "boolean",
            label: "Read data",
            description: "entity.read",
            disabled: true,
          },
        ]}
        values={{ "permission:read": true }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain("Read data");
    expect(markup).toContain("entity.read");
    expect(markup).toContain('disabled=""');
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

  it("can contribute fields without creating a nested form", () => {
    const markup = renderToStaticMarkup(
      <form>
        <FormRenderer
          fields={[{ name: "title", type: "text", label: "Title" }]}
          values={{ title: "Draft" }}
          onChange={vi.fn()}
          renderMode="content"
          showActions={false}
        />
      </form>,
    );

    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup).toContain('name="title"');
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

  it("renders a configured destructive action in the shared action bar", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[]}
        values={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        destructiveAction={{ label: "Delete", onClick: vi.fn() }}
      />,
    );

    expect(markup).toContain("Delete");
    expect(markup).toContain("text-rose-700");
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
    expect(markup).toContain("text-rose-600");
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

  it("renders node selection from the shared form definition", () => {
    const markup = renderToStaticMarkup(
      <FormRenderer
        fields={[{
          name: "nodeId",
          type: "nodeTree",
          label: "Node",
          required: true,
          nodes: [{
            id: "root",
            parentId: null,
            name: "Root",
            pathLabel: "Root",
          }],
          labels: {
            instruction: "Choose a node",
            empty: "No nodes",
            dropPlaceholder: "Drop here",
            expand: "Expand",
            collapse: "Collapse",
          },
        }]}
        values={{ nodeId: "root" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain('data-node-tree-field="nodeId"');
    expect(markup).toContain('data-selected-node-id="root"');
    expect(markup).toContain("Root");
  });

  it("rejects duplicate node IDs in a tree field definition", () => {
    expect(() => defineForm({
      key: "invalid-tree",
      version: "1",
      fields: [{
        name: "nodeId",
        type: "nodeTree",
        label: "Node",
        nodes: [
          { id: "same", parentId: null, name: "One", pathLabel: "One" },
          { id: "same", parentId: null, name: "Two", pathLabel: "Two" },
        ],
        labels: {
          instruction: "Choose",
          empty: "Empty",
          dropPlaceholder: "Drop",
          expand: "Expand",
          collapse: "Collapse",
        },
      }],
    })).toThrow("must declare unique node IDs");
  });
});
