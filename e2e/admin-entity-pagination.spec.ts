/** Verifies observable paged administrative entity queries across both adapters. */
import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.E2E_ENTITY_PAGE_SEED === 'true';
const ROOT_NODE_ID = '70000000-0000-0000-0000-000000000002';
const FIRST_ENTITY_ID = '81000000-0000-0000-0000-000000000001';

async function login(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /^Accedi$/ }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
}

async function exercise(page: Page, baseUrl: string): Promise<void> {
  await login(page, baseUrl);
  await page.goto(`${baseUrl}/admin/content/entities`);
  await expect(page.getByText('Paged entity 01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Avanti|Next page/i }).click();
  await expect(page.getByText('Paged entity 26', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Indietro|Previous page/i }).click();
  await expect(page.getByText('Paged entity 01', { exact: true })).toBeVisible();

  await page.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}/entities/${FIRST_ENTITY_ID}`);
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByLabel('Descrizione').fill('Selective cache update');
  await page.getByLabel('Email Address *').fill('paged-entity-01@e2e.test');
  await page.getByLabel('Phone Number *').fill('+39000000001');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText('Entità aggiornata con successo.')).toBeVisible();
  await page.goto(`${baseUrl}/admin/content/entities`);
  await expect(page.getByText('Paged entity 01', { exact: true })).toBeVisible();

  await page.getByRole('searchbox', { name: /Cerca entità|Search entities/i }).fill('Paged entity 26');
  await expect(page.getByText('Paged entity 26', { exact: true })).toBeVisible();
  await expect(page.getByText('Paged entity 01', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Nome|Name/i }).click();
  await expect(page.getByText('Paged entity 26', { exact: true })).toBeVisible();
}

test.describe('administrative entity pagination', () => {
  test.skip(!enabled, 'Run through pnpm e2e:admin-entity-pages.');
  test('keeps paged entity results correct with the SQLite standalone fallback', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await exercise(page, process.env.E2E_SQLITE_BASE_URL!);
    } finally {
      await context.close();
    }
  });

  test('keeps paged entity results correct after a selective PostgreSQL entity update', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await exercise(page, process.env.E2E_POSTGRES_BASE_URL!);
    } finally {
      await context.close();
    }
  });
});
