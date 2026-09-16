import { expect, test } from '@playwright/test';

const enabled = process.env.E2E_ADMIN_PARITY_RUN === 'true'
  && Boolean(process.env.E2E_SQLITE_BASE_URL)
  && Boolean(process.env.E2E_ADMIN_EMAIL)
  && Boolean(process.env.E2E_ADMIN_PASSWORD);

test.describe('admin form hydration', () => {
  test.skip(!enabled, 'Requires the isolated admin parity fixture.');

  test('opens a type form from an explicit user request', async ({ page }) => {
    const baseUrl = process.env.E2E_SQLITE_BASE_URL!;
    await page.goto(`${baseUrl}/login`);
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_ADMIN_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /^Accedi$/ }).click();
    await expect(page).toHaveURL(new RegExp(`${baseUrl}/?$`));

    await page.goto(`${baseUrl}/admin/model/types`);
    await expect(page.getByRole('row').filter({ hasText: 'admin_parity_root' })).toBeVisible();
    await page.getByRole('button', { name: /^\+?\s*Crea tipo(?: nodo| entità)?$/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Chiave tipo *')).toBeVisible();
  });
});
