/** Verifies browser password guidance mirrors the shared Core policy. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordRequirements } from "./PasswordRequirements";

describe("PasswordRequirements", () => {
  it("flags a password without a required special character", () => {
    const markup = renderToStaticMarkup(
      <PasswordRequirements password="Password123456" />,
    );

    expect(markup).toContain("Un carattere speciale");
    expect(markup).toContain("✕");
  });
});
