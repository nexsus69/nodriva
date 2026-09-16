/** Exercises recovery failure/retry with real databases and retained browser input. */
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
      const token = profile === 'sqlite' ? process.env.E2E_RECOVERY_SQLITE_TOKEN : process.env.E2E_RECOVERY_POSTGRES_TOKEN;
      const userId = profile === 'sqlite' ? process.env.E2E_RECOVERY_SQLITE_USER_ID : process.env.E2E_RECOVERY_POSTGRES_USER_ID;
      if (!token || !userId) throw new Error('Recovery fixture is missing.');
      const baseUrl = profile === 'sqlite' ? process.env.E2E_SQLITE_BASE_URL : process.env.E2E_POSTGRES_BASE_URL;
      const dropFault = async () => {
        await query('DROP TRIGGER IF EXISTS recovery_e2e_audit_fault' + (pool ? ' ON audit_logs' : ''));
        if (pool) await query('DROP FUNCTION IF EXISTS recovery_e2e_audit_fault()');
      };
      try {
        await page.goto(`${baseUrl}/account/complete?token=invalid-token`);
        await page.getByPlaceholder('Nuova password', { exact: true }).fill(password);
        await page.getByPlaceholder('Ripeti la password').fill(password);
        const submitButton = page.getByRole('button', { name: 'Imposta password' });
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
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
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        await expect(page.getByRole('status')).toHaveText('Si è verificato un errore interno. Riprova più tardi.');
        await expect(page.getByPlaceholder('Nuova password', { exact: true })).toHaveValue(password);
        await expect(page.getByPlaceholder('Ripeti la password')).toHaveValue(password);
        await dropFault();
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        await expect(page.getByRole('status')).toHaveText('Password impostata e sessioni precedenti revocate.');
        await expect(page.getByRole('link', { name: 'Vai al login' })).toBeVisible();
      } finally {
        await dropFault();
        sqlite?.close();
        await pool?.end();
      }
    });
  });
}
