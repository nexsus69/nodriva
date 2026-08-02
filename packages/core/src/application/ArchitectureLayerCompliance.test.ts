import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(filePath);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [filePath] : [];
  });
}

describe('Architecture layer compliance', () => {
  it('keeps Domain and Application independent from PostgreSQL infrastructure', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const forbiddenImport = /from\s+['"].*(?:infrastructure|pg|PgExecutor)/;
    const violations = [
      ...listSourceFiles(path.join(srcRoot, 'domain')),
      ...listSourceFiles(path.join(srcRoot, 'application')),
    ].flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return forbiddenImport.test(source) ? [path.relative(srcRoot, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });
});
