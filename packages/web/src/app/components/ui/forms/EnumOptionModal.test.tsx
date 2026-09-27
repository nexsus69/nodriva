/** Verifies that managed enum options use the shared declarative form surface. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EnumOptionModal } from "./EnumOptionModal";

describe("EnumOptionModal", () => {
  it("renders validation, labels, and dark appearance through the shared form builder", () => {
    const markup = renderToStaticMarkup(
      <EnumOptionModal
        open
        values={{ value: "vip", label: "Cliente VIP" }}
        isDirty
        pending={false}
        failure={null}
        theme="dark"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Valore tecnico");
    expect(markup).toContain("Etichetta visibile");
    expect(markup).toContain('pattern="^[a-z][a-z0-9_\\-]*$"');
    expect(markup).toContain("border-slate-700 bg-slate-900");
    expect(markup).toContain("Annulla");
    expect(markup).not.toContain("Elimina modifiche");
  });
});
