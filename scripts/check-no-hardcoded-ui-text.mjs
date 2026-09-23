#!/usr/bin/env node
/** Prevents newly-added browser-facing text from bypassing the locale catalogue. */
import { execFileSync } from 'node:child_process';

const ignored = new Set([
  'packages/web/src/app/i18n/AppLocaleStore.ts',
]);
const sourceFile = /^packages\/web\/src\/.*\.(?:ts|tsx)$/;
const testFile = /\.(?:test|spec)\.(?:ts|tsx)$/;
const visibleJsxText = />\s*[^<{\s][^<{]*[A-Za-zÀ-ÿ][^<{]*</u;
const visibleAttribute = /\b(?:aria-label|title|placeholder|alt)\s*=\s*['"][^'"]*[A-Za-zÀ-ÿ][^'"]*['"]/u;
const clientMessage = /\b(?:setMessage|setError)\s*\(\s*['"][^'"]*[A-Za-zÀ-ÿ][^'"]*['"]/u;
const productBrand = />\s*Nodriva\s*</u;
const technicalPresentationTokens = /INITIALIZE SYSTEM|ID:/gu;

function changedSourceLines() {
  const output = execFileSync('git', ['diff', '--unified=0', '--no-color', 'HEAD'], { encoding: 'utf8' });
  const entries = [];
  let file = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6);
      continue;
    }
    if (!file || !line.startsWith('+') || line.startsWith('+++')) continue;
    entries.push({ file, content: line.slice(1) });
  }
  return entries;
}

const violations = changedSourceLines().flatMap(({ file, content }) => {
  if (!sourceFile.test(file) || testFile.test(file) || ignored.has(file)) return [];
  const presentation = content.replace(technicalPresentationTokens, '');
  const isViolation = (!presentation.includes('t(') && !productBrand.test(presentation) && visibleJsxText.test(presentation))
    || visibleAttribute.test(presentation)
    || clientMessage.test(content);
  return isViolation ? [`${file}: ${content.trim()}`] : [];
});

if (violations.length > 0) {
  console.error('I18n guard failed: add browser-facing text to AppLocaleStore and render it through the locale resolver.');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('I18n guard passed: no newly-added hardcoded browser-facing text.');
