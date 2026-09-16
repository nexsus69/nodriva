import { expect, test } from '@playwright/test';

const enabled = process.env.E2E_SCHEMA_RUN === 'true'
  && Boolean(process.env.E2E_EMAIL)
  && Boolean(process.env.E2E_PASSWORD)
  && Boolean(process.env.E2E_ENTITY_PARENT_NODE_ID)
  && Boolean(process.env.E2E_ENTITY_TYPE_KEY);

test.describe('dynamic entity schema', () => {
  test.skip(!enabled, 'Set E2E_SCHEMA_RUN and the isolated database fixture variables to run this test.');

  test('rejects an invalid payload then persists a valid entity', async ({ page }) => {
    const entityName = `E2E entity ${Date.now()}`;
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /Accedi/ }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto(`/nodes/${process.env.E2E_ENTITY_PARENT_NODE_ID}/entities/new`);
    const creationForm = page.locator('form');
    // Preserve the order declared by the isolated integration-customer fixture.
    const textInputs = creationForm.locator('input[type="text"]');
    await page.getByRole('combobox', { name: 'Tipo Entità *' }).click();
    await page.getByRole('option', {
      name: new RegExp(process.env.E2E_ENTITY_TYPE_KEY!),
    }).click();
    await expect(textInputs).toHaveCount(3);
    await expect(page.getByText('Email Address *')).toBeVisible();
    await expect(page.getByText('Phone Number *')).toBeVisible();
    await textInputs.nth(0).fill(entityName);
    await textInputs.nth(1).fill('not-an-email');
    await textInputs.nth(2).fill('123456');
    await expect(page.getByRole('button', { name: 'Crea Entità' })).toBeEnabled();
    await page.getByRole('button', { name: 'Crea Entità' }).click();
    await expect(page.getByText('Dynamic schema validation failed for entity payload.')).toBeVisible();

    await textInputs.nth(1).fill('schema@example.test');
    await page.getByRole('button', { name: 'Crea Entità' }).click();
    await expect(page).toHaveURL(new RegExp(`/nodes/${process.env.E2E_ENTITY_PARENT_NODE_ID}$`));
    await expect(page.getByRole('link', { name: entityName, exact: true }).first()).toBeVisible();
  });
});
