import { expect, test } from '@playwright/test';

const e2eEnabled = process.env.E2E_RUN === 'true'
  && Boolean(process.env.E2E_EMAIL)
  && Boolean(process.env.E2E_PASSWORD)
  && Boolean(process.env.E2E_USER_ID);

test.describe('administrative lock lifecycle', () => {
  test.skip(!e2eEnabled, 'Set E2E_RUN=true, E2E_EMAIL, E2E_PASSWORD and E2E_USER_ID to run browser tests.');

  async function login(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /Accedi/ }).click();
    await expect(page).toHaveURL(/\/$/);
  }

  test('propagates acquisition and release between two authenticated sessions', async ({ browser, baseURL }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();
    const detailUrl = `/admin/users/${process.env.E2E_USER_ID}`;

    try {
      await Promise.all([login(firstPage), login(secondPage)]);
      await Promise.all([firstPage.goto(detailUrl), secondPage.goto(detailUrl)]);

      await expect(firstPage.getByRole('button', { name: 'Acquisisci lock' })).toBeVisible();
      await expect(secondPage.getByRole('button', { name: 'Acquisisci lock' })).toBeVisible();

      await firstPage.getByRole('button', { name: 'Acquisisci lock' }).click();
      await expect(firstPage.getByText('Lock amministrativo attivo: puoi modificare questa risorsa.')).toBeVisible();
      await expect(secondPage.getByText('Modifica temporaneamente bloccata da un altro utente.')).toBeVisible();

      await firstPage.getByRole('button', { name: 'Rilascia lock' }).click();
      await expect(secondPage.getByRole('button', { name: 'Acquisisci lock' })).toBeVisible();
    } finally {
      await first.close();
      await second.close();
    }
  });
});
