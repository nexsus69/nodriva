import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await mkdtemp(path.join(os.tmpdir(), 'nodriva-sqlite-backup-'));
try {
  const source = path.join(root, 'source.sqlite');
  const db = new DatabaseSync(source);
  db.exec("CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO records(value) VALUES ('verified'); CREATE TABLE system_settings (setting_key TEXT PRIMARY KEY, value_text TEXT, deleted_at TEXT);");
  db.close();
  const backup = path.join(root, 'backup.sqlite');
  const result = spawnSync(process.execPath, ['scripts/sqlite-backup-verify.mjs', 'backup-verify', backup], { cwd: process.cwd(), env: { ...process.env, SQLITE_DATABASE_PATH: source } });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  const restored = new DatabaseSync(backup, { readOnly: true });
  if (restored.prepare('SELECT value FROM records').get()?.value !== 'verified') throw new Error('restored record is missing');
  restored.close();
  const manifest = JSON.parse(await readFile(`${backup}.manifest.json`, 'utf8'));
  if (manifest.status !== 'completed' || manifest.provider !== 'sqlite-snapshot' || manifest.restoreVerification !== 'passed') throw new Error('invalid manifest');
  const maintenanceRoot = path.join(root, 'maintenance');
  const maintenance = spawnSync(process.execPath, ['scripts/sqlite-backup-maintenance.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, SQLITE_DATABASE_PATH: source, BACKUP_ROOT: maintenanceRoot },
  });
  if (maintenance.status !== 0) throw new Error(maintenance.stderr.toString());
  const status = JSON.parse(await readFile(path.join(maintenanceRoot, 'last-status.json'), 'utf8'));
  if (status.status !== 'completed' || status.restoreVerification !== 'passed') throw new Error('invalid maintenance status');
  const policy = new DatabaseSync(source);
  policy.exec("INSERT INTO system_settings(setting_key, value_text, deleted_at) VALUES ('backup.scheduledEnabled', 'false', NULL)");
  policy.close();
  const paused = spawnSync(process.execPath, ['scripts/sqlite-backup-maintenance.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, SQLITE_DATABASE_PATH: source, BACKUP_ROOT: maintenanceRoot },
  });
  if (paused.status !== 0) throw new Error(paused.stderr.toString());
  const pausedStatus = JSON.parse(await readFile(path.join(maintenanceRoot, 'last-status.json'), 'utf8'));
  if (pausedStatus.status !== 'paused') throw new Error('scheduled backup pause was ignored');
} finally { await rm(root, { recursive: true, force: true }); }
