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

/** Finds the contextual type-creation entry point exposed by the model module. */
function createTypeButton(page: Page) {
  return page.getByRole("button", {
    name: /^\+?\s*(?:Crea tipo(?: nodo| entità)?|Create (?:node |entity )?type)$/i,
  });
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
    await expect(page.getByRole('heading', { name: /Administration at a glance|Amministrazione in sintesi/i })).toBeVisible();
    await expect(page.getByTestId('admin-overview-attention')).toBeVisible();
    await expect(page.getByTestId('admin-overview-attention')).toContainText(/Needs attention|Richiede attenzione/i);
    await expect(page.getByRole('heading', { name: /Recent activity|Attività recente/i })).toBeVisible();
    const overviewModules = await page.locator('a[href^="/admin/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)))].sort(),
    );

    const sections: Array<[string, RegExp]> = [
      ['/admin/access/users', /Users|Utenti/i],
      ['/admin/access/roles', /Roles|Ruoli/i],
      ['/admin/access/scopes', /Scopes|Ambiti/i],
      ['/admin/model/types', /Tipi/i],
      ['/admin/content/nodes', /Nodes|Nodi/i],
      ['/admin/content/entities', /Entities|Entità/i],
      ['/admin/content/attachment-protection', /Attachment protection|Protezione allegati/i],
      ['/admin/model/placement-policies', /Placement policies|Politiche di posizionamento/i],
      ['/admin/model/field-protection', /Field protection|Protezione campi/i],
      ['/admin/automation/workflows', /Workflows|Workflow/i],
      ['/admin/governance/audit', /Audit log|Log audit/i],
      ['/admin/governance/audit-recording', /Audit settings|Impostazioni audit/i],
      ['/admin/governance/recycle-bin', /Recycle bin|Cestino/i],
      ['/admin/platform/runtime', /Runtime and integrations|Runtime e integrazioni/i],
      ['/admin/platform/session-security', /Session security|Sicurezza sessione/i],
      ['/admin/platform/other-settings', /Other settings|Altre impostazioni/i],
    ];
    const loadedSections: string[] = [];
    for (const [path, heading] of sections) {
      await page.goto(`${baseUrl}${path}`);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await assertNoAdminError(page, suffix);
      loadedSections.push(path);
    }

    for (const retiredPath of ['/admin/types', '/admin/users', '/admin/security/roles', '/admin/system/config', '/admin/audit']) {
      await page.goto(`${baseUrl}${retiredPath}`);
      await expect(page.getByRole('heading', { name: /Administrative module unavailable|Modulo amministrativo non disponibile/i })).toBeVisible();
    }

    await page.goto(`${baseUrl}/admin/platform/runtime`);
    await expect(page.getByText(/Realtime synchronization|Sincronizzazione realtime/i)).toBeVisible();
    await page.goto(`${baseUrl}/admin/governance/audit-recording`);
    await expect(page.getByText(/Record ordinary lock activity|Registra attività lock ordinaria/i)).toBeVisible();

    await page.goto(`${baseUrl}/admin/access/roles`);
    await page.getByRole('button', { name: /^\+?\s*Crea ruolo$|^\+?\s*Create role$/i }).click();
    const roleNameInput = page.getByLabel(/Nome \*/i);
    const roleKeyInput = page.getByLabel(/Chiave ruolo \*/i);
    await roleNameInput.fill(roleName);
    await expect(roleNameInput).toHaveValue(roleName);
    await expect(roleKeyInput).toHaveValue(roleKey);
    await page.getByRole('dialog').getByRole('button', { name: /^Crea ruolo$|^Create role$/i }).click();
    await expect(page.getByText(roleKey, { exact: true })).toBeVisible();
    const createdRoleVisible = await page.getByText(roleKey, { exact: true }).isVisible();
    await page.getByRole('row', { name: roleName }).click();
    await expect(page.getByRole('heading', { name: roleName })).toBeVisible();
    await expect(page.getByRole('switch').first()).toBeVisible();
    await expect(page.getByText(/Node · Read|Nodo · Lettura/i)).toBeVisible();
    loadedDetailViews.push('role');

    await page.goto(`${baseUrl}/admin/model/types`);
    await createTypeButton(page).click();
    const nodeTypeKeyInput = page.getByLabel(/Chiave tipo \*/i);
    const nodeTypeNameInput = page.getByLabel('Nome *');
    await nodeTypeKeyInput.fill(nodeTypeKey);
    await nodeTypeNameInput.fill(nodeTypeName);
    await expect(nodeTypeKeyInput).toHaveValue(nodeTypeKey);
    await expect(nodeTypeNameInput).toHaveValue(nodeTypeName);
    await page.getByRole('button', { name: /Avanti|Next/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Crea tipo$|^Create type$/i }).click();
    await expect(page.getByText(nodeTypeKey, { exact: true })).toBeVisible();
    const createdNodeTypeVisible = await page.getByText(nodeTypeKey, { exact: true }).isVisible();
    await page.getByRole('row', { name: nodeTypeName }).click();
    await expect(page.getByRole('heading', { name: nodeTypeName })).toBeVisible();
    await page.getByRole('button', { name: /Fields \(0\)|Campi \(0\)/i }).click();
    await page.getByRole('button', { name: /Add field|Aggiungi campo/i }).click();
    await page.getByRole('combobox', { name: /Data type|Tipo dato/i }).click();
    await expect(page.getByRole('option', { name: /Date and time|Data e ora/i })).toBeVisible();
    await page.getByRole('dialog').locator('button:not([aria-label])').filter({ hasText: /Cancel|Annulla/i }).click();
    loadedDetailViews.push('node-type');

    await page.goto(`${baseUrl}/admin/model/types`);
    await expect(page.getByRole('heading', { name: nodeTypeName })).toBeVisible();
    const backToTypeList = page.getByRole('button', { name: /Torna alla lista|Back to list/i }).first();
    if (await backToTypeList.isVisible()) {
      await backToTypeList.click({ force: true });
      await expect(page.getByRole('button', { name: /Tipi entità|Entity types/i })).toBeVisible();
    }
    await page.getByRole('button', { name: /Tipi entità|Entity types/i }).click();
    await createTypeButton(page).click();
    await page.getByLabel(/Chiave tipo \*/i).fill(entityTypeKey);
    await page.getByLabel(/Nome \*/i).fill(entityTypeName);
    await page.getByRole('button', { name: /Avanti|Next/i }).click();
    await page.getByLabel(/Tabella storage \*/i).fill(`entity_${entityTypeKey}`);
    await page.getByRole('dialog').getByRole('button', { name: /^Crea tipo$|^Create type$/i }).click();
    await expect(page.getByText(entityTypeKey, { exact: true })).toBeVisible();
    const createdEntityTypeVisible = await page.getByText(entityTypeKey, { exact: true }).isVisible();
    await page.getByRole('row', { name: entityTypeName }).click();
    await expect(page.getByRole('heading', { name: entityTypeName })).toBeVisible();
    loadedDetailViews.push('entity-type');

    await page.goto(`${baseUrl}/nodes/70000000-0000-0000-0000-000000000002`);
    await expect(page.getByRole('heading', { name: 'Admin parity root' })).toBeVisible();
    loadedDetailViews.push('node');

    await page.goto(`${baseUrl}/admin/governance/audit`);
    const expectedActions = [
      { value: 'security.create_role', label: /Sicurezza · Creazione|Security · Created/i },
      { value: 'type_admin.create_type', label: /Tipo · Amministrazione · Creazione · Tipo|Type · Administration · Created · Type/i },
    ];
    for (const action of expectedActions) await expect(page.getByText(action.label).first()).toBeVisible();
    const auditActions = expectedActions.map((action) => action.value).sort();

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
        '/admin/access/users',
        '/admin/access/roles',
        '/admin/access/scopes',
        '/admin/model/types',
        '/admin/content/nodes',
        '/admin/content/entities',
        '/admin/content/attachment-protection',
        '/admin/model/placement-policies',
        '/admin/model/field-protection',
        '/admin/automation/workflows',
        '/admin/governance/audit',
        '/admin/governance/audit-recording',
        '/admin/governance/recycle-bin',
        '/admin/platform/runtime',
        '/admin/platform/session-security',
        '/admin/platform/other-settings',
      ],
      createdRoleVisible: true,
      createdNodeTypeVisible: true,
      createdEntityTypeVisible: true,
      loadedDetailViews: ['role', 'node-type', 'entity-type', 'node'],
      auditActions: ['security.create_role', 'type_admin.create_type'],
    });
  });
});
