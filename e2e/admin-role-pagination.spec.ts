/** Verifies remote role paging, search and sort on both supported adapters. */
import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.E2E_ROLE_PAGE_SEED === 'true';

async function login(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /^Accedi$/ }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
}

async function exercise(page: Page, baseUrl: string): Promise<void> {
  await login(page, baseUrl);
  await page.goto(`${baseUrl}/admin/access/roles`);
  await expect(page.getByText('00 Paged role 01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Avanti|Next page/i }).click();
  await expect(page.getByText('00 Paged role 26', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Indietro|Previous page/i }).click();
  await expect(page.getByText('00 Paged role 01', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: /Cerca ruoli|Search roles/i }).fill('00 Paged role 26');
  await expect(page.getByText('00 Paged role 26', { exact: true })).toBeVisible();
  await expect(page.getByText('00 Paged role 01', { exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: /Cerca ruoli|Search roles/i }).fill('');
  await expect(page.getByText('00 Paged role 01', { exact: true })).toBeVisible();
  const nameSort = page.getByRole('button', { name: /Nome|Name/i });
  await nameSort.click();
  await nameSort.click();
  await expect(nameSort.locator('..')).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByText('00 Paged role 26', { exact: true })).toBeVisible();
  await expect(page.getByText('00 Paged role 01', { exact: true })).toHaveCount(0);
}

test.describe('administrative role pagination', () => {
  test.skip(!enabled, 'Run with PARITY_ROLE_PAGE_SEED=true.');
  for (const [name, baseUrl] of [['SQLite', process.env.E2E_SQLITE_BASE_URL], ['PostgreSQL', process.env.E2E_POSTGRES_BASE_URL]] as const) {
    test(`keeps remote role pages, search and sort correct on ${name}`, async ({ browser }) => {
      const context = await browser.newContext();
      try { await exercise(await context.newPage(), baseUrl!); } finally { await context.close(); }
    });
  }
});
