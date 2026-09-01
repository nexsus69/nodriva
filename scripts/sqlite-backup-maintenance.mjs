#!/usr/bin/env node
/** Maintains verified SQLite snapshots with the same operational status contract as PostgreSQL. */
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const backupRoot = process.env.BACKUP_ROOT ?? './var/backups/sqlite';
const statusFile = process.env.BACKUP_STATUS_FILE ?? path.join(backupRoot, 'last-status.json');
const sourcePath = process.env.SQLITE_DATABASE_PATH ?? './data/dashboard.sqlite';
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? '30');
const lockPath = path.join(backupRoot, '.maintenance.lock');

if (!Number.isInteger(retentionDays) || retentionDays < 0) throw new Error('BACKUP_RETENTION_DAYS must be a non-negative integer.');

async function writeStatus(status, message, details = {}) {
  await writeFile(statusFile, `${JSON.stringify({ status, message, ...details, completedAt: new Date().toISOString() })}\n`, { mode: 0o600 });
}

function scheduledEnabled() {
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    try {
      const row = database.prepare("SELECT value_text FROM system_settings WHERE setting_key='backup.scheduledEnabled' AND deleted_at IS NULL").get();
      return row?.value_text !== 'false';
    } catch (error) {
      if (error instanceof Error && error.message.includes('no such table')) return true;
      throw error;
    }
  } finally { database.close(); }
}

async function applyRetention() {
  const cutoff = Date.now() - retentionDays * 86_400_000;
  for (const entry of await readdir(backupRoot, { withFileTypes: true })) {
    if (!entry.isFile() || (!entry.name.endsWith('.sqlite') && !entry.name.endsWith('.sqlite.manifest.json'))) continue;
    const target = path.join(backupRoot, entry.name);
    if ((await stat(target)).mtimeMs < cutoff) await rm(target, { force: true });
  }
}

async function main() {
  await mkdir(backupRoot, { recursive: true, mode: 0o700 });
  await mkdir(path.dirname(statusFile), { recursive: true, mode: 0o700 });
  try { await mkdir(lockPath, { mode: 0o700 }); } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('SQLite backup maintenance is already running.');
    throw error;
  }
  try {
    if (!scheduledEnabled()) {
      await writeStatus('paused', 'scheduled backup disabled by runtime policy', { provider: 'sqlite-snapshot' });
      return;
    }
    const output = path.join(backupRoot, `dashboard_${new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')}.sqlite`);
    const result = spawnSync(process.execPath, ['scripts/sqlite-backup-verify.mjs', 'backup-verify', output], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'SQLite backup verification failed.');
    const manifest = JSON.parse(await readFile(`${output}.manifest.json`, 'utf8'));
    await applyRetention();
    await writeStatus('completed', 'backup and restore verification passed', manifest);
  } catch (error) {
    await writeStatus('failed', 'backup maintenance failed', { provider: 'sqlite-snapshot' });
    throw error;
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
