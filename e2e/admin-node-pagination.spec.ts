/** Verifies observable paged administrative node queries across both adapters. */
import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.E2E_ENTITY_PAGE_SEED === 'true';
const FIRST_NODE_ID = '82000000-0000-0000-0000-000000000001';

async function login(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /^Accedi$/ }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
}

async function exercise(page: Page, baseUrl: string): Promise<void> {
  await login(page, baseUrl);
  await page.goto(`${baseUrl}/admin/content/nodes`);
  await expect(page.getByText('Paged node 01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Avanti|Next page/i }).click();
  await expect(page.getByText('Paged node 26', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Indietro|Previous page/i }).click();
  await expect(page.getByText('Paged node 01', { exact: true })).toBeVisible();

  await page.goto(`${baseUrl}/nodes/${FIRST_NODE_ID}`);
  // The detail screen hydrates the visible node-tree lock indicators. Wait for
  // that bounded client bootstrap before exercising the interactive lock
  // control; otherwise Playwright can click server-rendered markup before its
  // client handler is attached on the slower PostgreSQL profile.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(page.getByLabel('Nome nodo *')).toBeVisible();
  await page.getByLabel('Descrizione').first().fill('Selective node cache update');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText('Nodo aggiornato con successo.')).toBeVisible();
  await page.goto(`${baseUrl}/admin/content/nodes`);
  await expect(page.getByText('Paged node 01', { exact: true })).toBeVisible();

  await page.getByRole('searchbox', { name: /Cerca nodi|Search nodes/i }).fill('Paged node 26');
  await expect(page.getByText('Paged node 26', { exact: true })).toBeVisible();
  await expect(page.getByText('Paged node 01', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Nome|Name/i }).click();
  await expect(page.getByText('Paged node 26', { exact: true })).toBeVisible();
}

test.describe('administrative node pagination', () => {
  test.skip(!enabled, 'Run through pnpm e2e:admin-node-pages.');
  test('keeps paged node results correct with the SQLite standalone fallback', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try { await exercise(page, process.env.E2E_SQLITE_BASE_URL!); } finally { await context.close(); }
  });

  test('keeps paged node results correct after a selective PostgreSQL node update', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try { await exercise(page, process.env.E2E_POSTGRES_BASE_URL!); } finally { await context.close(); }
  });
});
