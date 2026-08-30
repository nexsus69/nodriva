import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.E2E_RUN === 'true'
  && Boolean(process.env.E2E_EMAIL)
  && Boolean(process.env.E2E_PASSWORD);

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /Accedi/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe('protezione modifiche non salvate', () => {
  test.skip(!enabled, 'Set E2E_RUN=true, E2E_EMAIL and E2E_PASSWORD to run browser tests.');

  test('mantiene i dati admin quando la chiusura del form viene annullata', async ({ page }) => {
    await login(page);
    await page.goto('/admin/access/users');
    await page.getByRole('button', { name: /Registra nuovo utente/i }).click();
    const email = page.getByLabel('Email Utente *');
    await email.fill('bozza@example.test');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('modifiche non salvate');
      await dialog.dismiss();
    });
    await page.getByRole('heading', { name: /Registra nuovo utente/i })
      .locator('..')
      .getByRole('button')
      .click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(email).toHaveValue('bozza@example.test');
  });

  test('chiede conferma anche usando la cronologia del browser', async ({ page }) => {
    await login(page);
    await page.goto('/admin');
    await page.goto('/admin/access/users');
    await page.getByRole('button', { name: /Registra nuovo utente/i }).click();
    await page.getByLabel('Email Utente *').fill('cronologia@example.test');

    page.once('dialog', async (dialog) => {
      // I browser non espongono il testo personalizzato del dialogo nativo
      // beforeunload; la presenza del dialogo è il contratto osservabile.
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.back());

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByLabel('Email Utente *')).toHaveValue('cronologia@example.test');
  });
});
