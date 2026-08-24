#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const sourcePattern = /^(packages\/(?:core|web)\/src\/.*\.(?:ts|tsx))$/;
const changedFiles = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', 'HEAD^', 'HEAD'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

const missing = [];
for (const file of changedFiles) {
  if (!sourcePattern.test(file)) continue;
  // Deleted or renamed sources may still appear in a commit-range comparison.
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const header = source.split('\n').slice(0, 40).join('\n');
  if (!header.includes('/**') && !header.includes('// Purpose:')) missing.push(file);
}

if (missing.length > 0) {
  console.error('Source documentation guard failed. Add an English module-purpose comment to:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Source documentation guard passed for ${changedFiles.filter((file) => sourcePattern.test(file)).length} changed source file(s).`);
