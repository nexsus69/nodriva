import { expect, test, type Browser, type Page } from '@playwright/test';

const enabled = process.env.E2E_ADMIN_PARITY_RUN === 'true'
  && Boolean(process.env.E2E_SQLITE_BASE_URL)
  && Boolean(process.env.E2E_POSTGRES_BASE_URL)
  && Boolean(process.env.E2E_ADMIN_EMAIL)
  && Boolean(process.env.E2E_ADMIN_PASSWORD);

interface AdminOutcome {
  overviewModules: string[];
  loadedSections: string[];
  createdRoleVisible: boolean;
  createdNodeTypeVisible: boolean;
  createdEntityTypeVisible: boolean;
  loadedDetailViews: string[];
  auditActions: string[];
}

async function login(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /^Accedi$/ }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
}

async function assertNoAdminError(page: Page, adapter: string): Promise<void> {
  const visibleAlerts = page.locator('[role="alert"]:visible');
  const errorPanels = page.getByText(/^Errore \[/);
  const messages = [...await visibleAlerts.allTextContents(), ...await errorPanels.allTextContents()]
    .map((message) => message.trim())
    .filter(Boolean);
  if (messages.length > 0) {
    throw new Error(`${adapter} ${new URL(page.url()).pathname}: ${messages.join(' | ')}`);
  }
}

async function exerciseAdmin(browser: Browser, baseUrl: string, suffix: string): Promise<AdminOutcome> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const roleKey = `parity_role_${suffix}`;
  const roleName = `Parity role ${suffix}`;
  const nodeTypeKey = `parity_node_${suffix}`;
  const nodeTypeName = `Parity node ${suffix}`;
  const entityTypeKey = `parity_entity_${suffix}`;
  const entityTypeName = `Parity entity ${suffix}`;
  const loadedDetailViews: string[] = [];

  try {
    await login(page, baseUrl);

    await page.goto(`${baseUrl}/admin`);
    await expect(page.getByRole('heading', { name: /Administration at a glance|Centro di Controllo Amministrativo/i })).toBeVisible();
    const overviewModules = await page.locator('a[href^="/admin/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)))].sort(),
    );

    const sections: Array<[string, RegExp]> = [
      ['/admin/users', /Users/i],
      ['/admin/security/roles', /Roles/i],
      ['/admin/security/scopes', /Scopes/i],
      ['/admin/types', /Tipi/i],
      ['/admin/system/config', /Capabilities/i],
      ['/admin/system/placement-policies', /Placement policies/i],
      ['/admin/audit', /Audit log/i],
      ['/admin/recycle-bin', /Recycle bin/i],
    ];
    const loadedSections: string[] = [];
    for (const [path, heading] of sections) {
      await page.goto(`${baseUrl}${path}`);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await assertNoAdminError(page, suffix);
      loadedSections.push(path);
    }

    await page.goto(`${baseUrl}/admin/security/roles`);
    await page.getByRole('button', { name: /^\+?\s*Crea ruolo$|^\+?\s*Create role$/i }).click();
    const roleNameInput = page.getByLabel(/Nome \*/i);
    const roleKeyInput = page.getByLabel(/Chiave ruolo \*/i);
    await roleNameInput.fill(roleName);
    await roleKeyInput.fill(roleKey);
    await expect(roleNameInput).toHaveValue(roleName);
    await expect(roleKeyInput).toHaveValue(roleKey);
    await page.getByRole('button', { name: /^Crea ruolo$|^Create role$/i }).click();
    await expect(page.getByText(roleKey, { exact: true })).toBeVisible();
    const createdRoleVisible = await page.getByText(roleKey, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: roleKey }).getByRole('button', { name: /Apri|Open/i }).click();
    await expect(page.getByRole('heading', { name: roleName })).toBeVisible();
    loadedDetailViews.push('role');

    await page.goto(`${baseUrl}/admin/types`);
    await page.getByRole('button', { name: /^\+?\s*Crea tipo$|^\+?\s*Create type$/i }).click();
    await page.getByLabel(/Chiave tipo \*/i).fill(nodeTypeKey);
    await page.getByLabel('Nome *').fill(nodeTypeName);
    await page.getByRole('button', { name: /Avanti|Next/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Crea tipo$|^Create type$/i }).click();
    await expect(page.getByText(nodeTypeKey, { exact: true })).toBeVisible();
    const createdNodeTypeVisible = await page.getByText(nodeTypeKey, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: nodeTypeKey }).getByRole('link', { name: /Apri|Open/i }).click();
    await expect(page.getByRole('heading', { name: nodeTypeName })).toBeVisible();
    loadedDetailViews.push('node-type');

    await page.goto(`${baseUrl}/admin/types`);
    await expect(page.getByRole('heading', { name: nodeTypeName })).toBeVisible();
    const backToTypeList = page.locator("button").filter({ hasText: /Torna alla lista|Back to list/i }).first();
    if (await backToTypeList.isVisible()) {
      await backToTypeList.click({ force: true });
      await expect(page.getByRole('button', { name: /Tipi entità|Entity types/i })).toBeVisible();
    }
    await page.getByRole('button', { name: /Tipi entità|Entity types/i }).click();
    await page.getByRole('button', { name: /^\+?\s*Crea tipo$|^\+?\s*Create type$/i }).click();
    await page.getByLabel(/Chiave tipo \*/i).fill(entityTypeKey);
    await page.getByLabel(/Nome \*/i).fill(entityTypeName);
    await page.getByRole('button', { name: /Avanti|Next/i }).click();
    await page.getByLabel(/Tabella storage \*/i).fill(`entity_${entityTypeKey}`);
    await page.getByRole('dialog').getByRole('button', { name: /^Crea tipo$|^Create type$/i }).click();
    await expect(page.getByText(entityTypeKey, { exact: true })).toBeVisible();
    const createdEntityTypeVisible = await page.getByText(entityTypeKey, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: entityTypeKey }).getByRole('link', { name: /Apri|Open/i }).click();
    await expect(page.getByRole('heading', { name: entityTypeName })).toBeVisible();
    loadedDetailViews.push('entity-type');

    await page.goto(`${baseUrl}/nodes/70000000-0000-0000-0000-000000000002`);
    await expect(page.getByRole('heading', { name: 'Admin parity root' })).toBeVisible();
    loadedDetailViews.push('node');

    await page.goto(`${baseUrl}/admin/audit`);
    const expectedActions = ['security.create_role', 'type_admin.create_type'];
    for (const action of expectedActions) await expect(page.getByText(action, { exact: true }).first()).toBeVisible();
    const auditActions = (await page.locator('table tbody tr').evaluateAll((rows) =>
      rows.map((row) => row.querySelector('td')?.textContent?.trim() ?? ''),
    ))
      .filter((value) => expectedActions.includes(value))
      .sort();

    return {
      overviewModules,
      loadedSections,
      createdRoleVisible,
      createdNodeTypeVisible,
      createdEntityTypeVisible,
      loadedDetailViews,
      auditActions,
    };
  } finally {
    await context.close();
  }
}

test.describe('admin panel SQLite/PostgreSQL parity', () => {
  test.skip(!enabled, 'Run through scripts/admin-parity-e2e.sh to provision both isolated adapters.');
  test.setTimeout(90_000);

  test('exposes the same admin sections and mutation outcomes on both adapters', async ({ browser }) => {
    const [sqlite, postgres] = await Promise.all([
      exerciseAdmin(browser, process.env.E2E_SQLITE_BASE_URL!, 'sqlite'),
      exerciseAdmin(browser, process.env.E2E_POSTGRES_BASE_URL!, 'postgres'),
    ]);
    expect(postgres).toEqual(sqlite);
    expect(sqlite).toMatchObject({
      loadedSections: [
        '/admin/users',
        '/admin/security/roles',
        '/admin/security/scopes',
        '/admin/types',
        '/admin/system/config',
        '/admin/system/placement-policies',
        '/admin/audit',
        '/admin/recycle-bin',
      ],
      createdRoleVisible: true,
      createdNodeTypeVisible: true,
      createdEntityTypeVisible: true,
      loadedDetailViews: ['role', 'node-type', 'entity-type', 'node'],
      auditActions: ['security.create_role', 'type_admin.create_type', 'type_admin.create_type'],
    });
  });
});
