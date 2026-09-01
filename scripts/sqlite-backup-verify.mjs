#!/usr/bin/env node
/** Creates and verifies a consistent SQLite backup without touching the live database. */
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [command, requestedPath] = process.argv.slice(2);
const sourcePath = process.env.SQLITE_DATABASE_PATH ?? './data/dashboard.sqlite';
const backupRoot = process.env.BACKUP_ROOT ?? './var/backups/sqlite';

function usage() {
  console.error('Usage: sqlite-backup-verify.mjs backup-verify [output-file] | verify <backup-file>');
  process.exit(2);
}
function quote(value) { return `'${value.replaceAll("'", "''")}'`; }
function checksum(data) { return createHash('sha256').update(data).digest('hex'); }
async function verify(file) {
  const bytes = await readFile(file);
  if (bytes.byteLength === 0) throw new Error('Backup file is empty.');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
    if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
    const schema = db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'").get()?.count;
    if (!Number.isInteger(schema) || schema < 1) throw new Error('Restored SQLite backup has no tables.');
  } finally { db.close(); }
  return { sizeBytes: bytes.byteLength, checksum: checksum(bytes) };
}
async function create(output) {
  await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.partial`;
  await unlink(temporary).catch(() => undefined);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try { source.exec(`VACUUM INTO ${quote(temporary)}`); } finally { source.close(); }
  await rename(temporary, output);
}
async function main() {
  if (command !== 'backup-verify' && command !== 'verify') usage();
  const output = requestedPath ?? path.join(backupRoot, `dashboard_${new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')}.sqlite`);
  if (command === 'backup-verify') await create(output);
  const verified = await verify(output);
  const manifest = { status: 'completed', provider: 'sqlite-snapshot', backupFile: path.basename(output), checksum: verified.checksum, sizeBytes: verified.sizeBytes, completedAt: new Date().toISOString() };
  await writeFile(`${output}.manifest.json`, `${JSON.stringify(manifest)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(manifest));
}
main().catch((error) => { console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
