/** Prevents Admin Panel modules from reintroducing parallel UI contracts. */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { APP_MESSAGES } from "@/app/i18n/AppLocaleStore";

const WEB_ROOT = path.resolve(__dirname, "..");
const ADMIN_ROOTS = [
  path.join(WEB_ROOT, "app/admin"),
  path.join(WEB_ROOT, "adminPanel"),
];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [entryPath]
      : [];
  });
}

describe("Admin Panel architecture", () => {
  const files = ADMIN_ROOTS.flatMap(sourceFiles);

  it("uses the application confirmation service instead of the legacy modal", () => {
    for (const file of files) {
      expect(fs.readFileSync(file, "utf8"), path.relative(WEB_ROOT, file))
        .not.toContain("ConfirmModal");
    }
  });

  it("renders tables and dialogs only through their shared hosts", () => {
    for (const file of files) {
      const relative = path.relative(WEB_ROOT, file);
      const source = fs.readFileSync(file, "utf8");
      if (!relative.endsWith("adminPanel/components/AdminTable.tsx")) {
        expect(source, relative).not.toMatch(/<table\b/);
      }
      if (!relative.endsWith("adminPanel/components/AdminSurfaceHost.tsx")) {
        expect(source, relative).not.toContain('role="dialog"');
      }
    }
  });

  it("defines every literal admin translation in both supported locales", () => {
    const literalKeys = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/t\(["'](admin\.[^"']+)["']/g)) {
        literalKeys.add(match[1]!);
      }
    }
    for (const key of literalKeys) {
      expect(APP_MESSAGES.en[key], `English: ${key}`).toBeTruthy();
      expect(APP_MESSAGES.it[key], `Italian: ${key}`).toBeTruthy();
    }
    expect(Object.keys(APP_MESSAGES.en).sort()).toEqual(
      Object.keys(APP_MESSAGES.it).sort(),
    );
  });
});
