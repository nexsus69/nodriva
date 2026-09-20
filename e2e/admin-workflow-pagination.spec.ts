/** Verifies the workflow catalogue remains server-paged on both supported adapters. */
import { expect, test, type Page } from '@playwright/test';
const enabled = process.env.E2E_WORKFLOW_PAGE_SEED === 'true';
async function login(page: Page, baseUrl: string) { await page.goto(`${baseUrl}/login`); await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_ADMIN_EMAIL!); await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!); await page.getByRole('button', { name: /^Accedi$/ }).click(); await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`)); }
test.describe('administrative workflow pagination', () => {
  test.skip(!enabled, 'Run with PARITY_WORKFLOW_PAGE_SEED=true.');
  for (const [name, baseUrl] of [['SQLite', process.env.E2E_SQLITE_BASE_URL], ['PostgreSQL', process.env.E2E_POSTGRES_BASE_URL]] as const) test(`pages, searches and sorts workflows on ${name}`, async ({ browser }) => {
    const context = await browser.newContext(); const page = await context.newPage();
    try { await login(page, baseUrl!); await page.goto(`${baseUrl}/admin/automation/workflows`); await expect(page.getByText('00 Paged workflow 01', { exact: true })).toBeVisible(); await page.getByRole('button', { name: /Avanti|Next page/i }).click(); await expect(page.getByText('00 Paged workflow 26', { exact: true })).toBeVisible(); await page.getByRole('searchbox', { name: /Cerca workflow|Search workflows/i }).fill('00 Paged workflow 26'); await expect(page.getByText('00 Paged workflow 26', { exact: true })).toBeVisible(); const nameSort = page.getByRole('button', { name: 'Workflow', exact: true }); await nameSort.click(); await nameSort.click(); await expect(nameSort.locator('..')).toHaveAttribute('aria-sort', 'descending'); } finally { await context.close(); }
  });
});
