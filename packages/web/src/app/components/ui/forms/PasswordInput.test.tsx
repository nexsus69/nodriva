/** Verifies password visibility controls retain contrast on light surfaces. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("uses the light-surface icon palette when requested", () => {
    const markup = renderToStaticMarkup(
      <PasswordInput
        value=""
        onChange={vi.fn()}
        tone="light"
      />,
    );

    expect(markup).toContain("text-slate-500");
    expect(markup).toContain("hover:text-slate-700");
    expect(markup).toContain('aria-label="Mostra password"');
  });
});
