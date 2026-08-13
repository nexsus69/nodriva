import { expect, test, type Browser, type Page } from '@playwright/test';

const enabled = process.env.E2E_ADMIN_PARITY_RUN === 'true'
  && Boolean(process.env.E2E_SQLITE_BASE_URL)
  && Boolean(process.env.E2E_POSTGRES_BASE_URL)
  && Boolean(process.env.E2E_ADMIN_EMAIL)
  && Boolean(process.env.E2E_ADMIN_PASSWORD);

interface AdminOutcome {
  overviewModules: string[];
  loadedSections: string[];
  createdUserVisible: boolean;
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
  const userEmail = `parity-${suffix}@dashboard.test`;
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
    await expect(page.getByRole('heading', { name: /Centro di Controllo Amministrativo/i })).toBeVisible();
    const overviewModules = await page.locator('a[href^="/admin/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)))].sort(),
    );

    const sections: Array<[string, RegExp]> = [
      ['/admin/users', /Gestione Utenti/i],
      ['/admin/security/roles', /Ruoli e Permessi/i],
      ['/admin/security/scopes', /Assegnazione ambiti/i],
      ['/admin/types', /Admin Dashboard — Tipi Modello/i],
      ['/admin/system/config', /Capacità Runtime & Impostazioni di Sistema/i],
      ['/admin/system/placement-policies', /Placement Policies/i],
      ['/admin/audit', /Audit Trail/i],
      ['/admin/recycle-bin', /Cestino e ripristino/i],
    ];
    const loadedSections: string[] = [];
    for (const [path, heading] of sections) {
      await page.goto(`${baseUrl}${path}`);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await assertNoAdminError(page, suffix);
      loadedSections.push(path);
    }

    await page.goto(`${baseUrl}/admin/users`);
    await page.getByRole('button', { name: /Registra nuovo utente/i }).click();
    await page.getByLabel('Email Utente').fill(userEmail);
    await page.getByLabel('Password Iniziale').fill('Parity-user-2026!');
    await page.getByRole('button', { name: 'Crea Account' }).click();
    await expect(page.getByText(userEmail, { exact: true })).toBeVisible();
    const createdUserVisible = await page.getByText(userEmail, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: userEmail }).getByRole('link', { name: /Dettaglio/i }).click();
    await expect(page.getByRole('heading', { name: userEmail })).toBeVisible();
    loadedDetailViews.push('user');

    await page.goto(`${baseUrl}/admin/security/roles`);
    await page.getByRole('button', { name: /Nuovo Ruolo/i }).click();
    const roleNameInput = page.getByLabel('Nome Ruolo *');
    const roleKeyInput = page.getByLabel('Chiave Ruolo (snake_case) *');
    await roleNameInput.fill(roleName);
    await roleKeyInput.fill(roleKey);
    await expect(roleNameInput).toHaveValue(roleName);
    await expect(roleKeyInput).toHaveValue(roleKey);
    await page.getByRole('button', { name: 'Crea Ruolo' }).click();
    await expect(page.getByText(roleKey, { exact: true })).toBeVisible();
    const createdRoleVisible = await page.getByText(roleKey, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: roleKey }).getByRole('link', { name: /Permessi/i }).click();
    await expect(page.getByRole('heading', { name: roleName })).toBeVisible();
    loadedDetailViews.push('role');

    await page.goto(`${baseUrl}/admin/types`);
    await page.getByRole('button', { name: /Crea Nuovo Nodo/i }).click();
    await page.getByLabel('Type Key *').fill(nodeTypeKey);
    await page.getByLabel('Nome *').fill(nodeTypeName);
    await page.getByRole('button', { name: 'Crea Tipo' }).click();
    await expect(page.getByText(nodeTypeKey, { exact: true })).toBeVisible();
    const createdNodeTypeVisible = await page.getByText(nodeTypeKey, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: nodeTypeKey }).getByRole('link', { name: /Dettaglio & Campi/i }).click();
    await expect(page.getByRole('heading', { name: nodeTypeName })).toBeVisible();
    loadedDetailViews.push('node-type');

    await page.goto(`${baseUrl}/admin/types`);
    await page.getByRole('button', { name: /Entity Types/i }).click();
    await page.getByRole('button', { name: /Crea Nuovo Entità/i }).click();
    await page.getByLabel('Type Key *').fill(entityTypeKey);
    await page.getByLabel('Nome *').fill(entityTypeName);
    await page.getByLabel('Storage Table (Fisica) *').fill(`entity_${entityTypeKey}`);
    await page.getByRole('button', { name: 'Crea Tipo' }).click();
    await expect(page.getByText(entityTypeKey, { exact: true })).toBeVisible();
    const createdEntityTypeVisible = await page.getByText(entityTypeKey, { exact: true }).isVisible();
    await page.getByRole('row').filter({ hasText: entityTypeKey }).getByRole('link', { name: /Dettaglio & Campi/i }).click();
    await expect(page.getByRole('heading', { name: entityTypeName })).toBeVisible();
    loadedDetailViews.push('entity-type');

    await page.goto(`${baseUrl}/nodes/70000000-0000-0000-0000-000000000002`);
    await expect(page.getByRole('heading', { name: 'Admin parity root' })).toBeVisible();
    loadedDetailViews.push('node');

    await page.goto(`${baseUrl}/admin/audit`);
    const expectedActions = ['security.create_role', 'type_admin.create_type', 'user.create'];
    for (const action of expectedActions) await expect(page.getByText(action, { exact: true }).first()).toBeVisible();
    const auditActions = (await page.locator('td[data-label="Azione"]').allTextContents())
      .map((value) => value.trim())
      .filter((value) => expectedActions.includes(value))
      .sort();

    return {
      overviewModules,
      loadedSections,
      createdUserVisible,
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
      createdUserVisible: true,
      createdRoleVisible: true,
      createdNodeTypeVisible: true,
      createdEntityTypeVisible: true,
      loadedDetailViews: ['user', 'role', 'node-type', 'entity-type', 'node'],
      auditActions: ['security.create_role', 'type_admin.create_type', 'type_admin.create_type', 'user.create'],
    });
  });
});
