/** Exercises recovery failure/retry with real databases and retained browser input. */
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';
import pg from 'pg';

const enabled = process.env.E2E_ADMIN_PARITY_RUN === 'true';
const password = 'Recovery-browser-2026!';

for (const profile of ['sqlite', 'postgres'] as const) {
  test.describe(`account recovery ${profile}`, () => {
    test.skip(!enabled, 'Run through pnpm e2e:parity with isolated fixtures.');
    test('distinguishes invalid links from failures and retries without losing the password', async ({ page }) => {
      const url = process.env.E2E_POSTGRES_DATABASE_URL;
      if (!url || !/(?:^|_)test(?:_|$)/.test(new URL(url).pathname.slice(1))) throw new Error('An isolated PostgreSQL test database is required.');
      const sqlitePath = process.env.E2E_SQLITE_DATABASE_PATH;
      if (!sqlitePath?.startsWith('/tmp/dashboard-admin-parity-')) throw new Error('An isolated SQLite fixture is required.');
      const sqlite = profile === 'sqlite' ? new DatabaseSync(sqlitePath) : undefined;
      const pool = profile === 'postgres' ? new pg.Pool({ connectionString: url }) : undefined;
      const query = async (sql: string, parameters: string[] = []) => {
        if (pool) { await pool.query(sql, parameters); return; }
        if (parameters.length) sqlite.prepare(sql.replace(/\$\d+/g, '?')).run(...parameters);
        else sqlite.exec(sql);
      };
      const userId = randomUUID();
      const token = randomUUID();
      const hash = createHash('sha256').update(token).digest('hex');
      const baseUrl = profile === 'sqlite' ? process.env.E2E_SQLITE_BASE_URL : process.env.E2E_POSTGRES_BASE_URL;
      const dropFault = async () => {
        await query('DROP TRIGGER IF EXISTS recovery_e2e_audit_fault' + (pool ? ' ON audit_logs' : ''));
        if (pool) await query('DROP FUNCTION IF EXISTS recovery_e2e_audit_fault()');
      };
      try {
        await query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [userId, `${userId}@recovery-e2e.test`, 'old-hash']);
        await query("INSERT INTO account_action_tokens(user_id,purpose,token_hash,expires_at,created_by) VALUES($1,'password_reset',$2,$3,$4)", [userId, hash, new Date(Date.now() + 600_000).toISOString(), '00000000-0000-0000-0000-000000000001']);
        await page.goto(`${baseUrl}/account/complete?token=invalid-token`);
        await page.getByPlaceholder('Nuova password', { exact: true }).fill(password);
        await page.getByPlaceholder('Ripeti la password').fill(password);
        await page.getByRole('button', { name: 'Imposta password' }).click();
        await expect(page.getByRole('status')).toHaveText('Il link non è valido, è scaduto o è già stato utilizzato.');
        await page.goto(`${baseUrl}/account/complete?token=${token}`);
        await page.getByPlaceholder('Nuova password', { exact: true }).fill(password);
        await page.getByPlaceholder('Ripeti la password').fill(password);
        // Fault injection is limited to this disposable identity and its audit.
        if (pool) {
          await query(`CREATE FUNCTION recovery_e2e_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.resource_id='${userId}' AND NEW.action_key='user.password_reset_completed' THEN RAISE EXCEPTION 'recovery e2e audit unavailable'; END IF;
            RETURN NEW; END $$`);
          await query('CREATE TRIGGER recovery_e2e_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION recovery_e2e_audit_fault()');
        } else {
          await query(`CREATE TRIGGER recovery_e2e_audit_fault BEFORE INSERT ON audit_logs
            WHEN NEW.resource_id='${userId}' AND NEW.action_key='user.password_reset_completed'
            BEGIN SELECT RAISE(ABORT, 'recovery e2e audit unavailable'); END`);
        }
        await page.getByRole('button', { name: 'Imposta password' }).click();
        await expect(page.getByRole('status')).toHaveText('Si è verificato un errore interno. Riprova più tardi.');
        await expect(page.getByPlaceholder('Nuova password', { exact: true })).toHaveValue(password);
        await expect(page.getByPlaceholder('Ripeti la password')).toHaveValue(password);
        await dropFault();
        await page.getByRole('button', { name: 'Imposta password' }).click();
        await expect(page.getByRole('status')).toHaveText('Password impostata e sessioni precedenti revocate.');
        await expect(page.getByRole('link', { name: 'Vai al login' })).toBeVisible();
      } finally {
        await dropFault();
        await query('DELETE FROM audit_logs WHERE resource_id=$1', [userId]);
        await query('DELETE FROM account_action_tokens WHERE user_id=$1', [userId]);
        await query('DELETE FROM users WHERE id=$1', [userId]);
        sqlite?.close();
        await pool?.end();
      }
    });
  });
}
