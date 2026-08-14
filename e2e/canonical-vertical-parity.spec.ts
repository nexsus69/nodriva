import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const enabled = process.env.E2E_ADMIN_PARITY_RUN === 'true'
  && Boolean(process.env.E2E_SQLITE_BASE_URL)
  && Boolean(process.env.E2E_POSTGRES_BASE_URL)
  && Boolean(process.env.E2E_ADMIN_EMAIL)
  && Boolean(process.env.E2E_ADMIN_PASSWORD);

const ROOT_NODE_ID = '70000000-0000-0000-0000-000000000002';
const OUTSIDE_NODE_ID = '70000000-0000-0000-0000-000000000003';
const OPERATOR_PASSWORD = 'Canonical-operator-2026!';
const OPERATOR_PERMISSIONS = [
  'node.read', 'node.create', 'node.edit', 'node.delete', 'node.restore',
  'entity.read', 'entity.create', 'entity.edit', 'entity.delete', 'entity.restore',
] as const;

interface CanonicalOutcome {
  outsideScopeDenied: boolean;
  childCreated: boolean;
  entityCreated: boolean;
  enumPersisted: boolean;
  relationPersisted: boolean;
  lockConflictObserved: boolean;
  rowVersionConflictObserved: boolean;
  entityRestored: boolean;
  auditActions: string[];
}

interface ScenarioNames {
  operatorEmail: string;
  roleKey: string;
  roleName: string;
  nodeTypeKey: string;
  nodeTypeName: string;
  entityTypeKey: string;
  entityTypeName: string;
  childName: string;
  firstEntityName: string;
  secondEntityName: string;
}

function scenarioNames(adapter: string): ScenarioNames {
  return {
    operatorEmail: `canonical-operator-${adapter}@dashboard.test`,
    roleKey: `canonical_operator_${adapter}`,
    roleName: `Canonical operator ${adapter}`,
    nodeTypeKey: `canonical_project_${adapter}`,
    nodeTypeName: `Canonical project ${adapter}`,
    entityTypeKey: `canonical_task_${adapter}`,
    entityTypeName: `Canonical task ${adapter}`,
    childName: `Canonical project ${adapter}`,
    firstEntityName: `Canonical task A ${adapter}`,
    secondEntityName: `Canonical task B ${adapter}`,
  };
}

async function login(page: Page, baseUrl: string, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^Accedi$/ }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
}

async function createType(page: Page, baseUrl: string, names: ScenarioNames): Promise<void> {
  await page.goto(`${baseUrl}/admin/types`);
  await expect(page.getByRole('row').filter({ hasText: 'admin_parity_root' })).toBeVisible();
  await page.getByRole('button', { name: /Crea Nuovo Nodo/i }).click();
  await page.getByLabel('Type Key *').fill(names.nodeTypeKey);
  await page.getByLabel('Nome *').fill(names.nodeTypeName);
  await expect(page.getByLabel('Nome *')).toHaveValue(names.nodeTypeName);
  await page.getByRole('button', { name: 'Crea Tipo' }).click();
  await expect(page.getByText(names.nodeTypeKey, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Entity Types/i }).click();
  await page.getByRole('button', { name: /Crea Nuovo Entità/i }).click();
  await page.getByLabel('Type Key *').fill(names.entityTypeKey);
  await page.getByLabel('Nome *').fill(names.entityTypeName);
  await page.getByLabel('Storage Table (Fisica) *').fill(`entity_${names.entityTypeKey}`);
  await expect(page.getByLabel('Nome *')).toHaveValue(names.entityTypeName);
  await expect(page.getByLabel('Storage Table (Fisica) *')).toHaveValue(`entity_${names.entityTypeKey}`);
  await page.getByRole('button', { name: 'Crea Tipo' }).click();
  await page.getByRole('row').filter({ hasText: names.entityTypeKey }).getByRole('link', { name: /Dettaglio & Campi/i }).click();
  await expect(page.getByRole('heading', { name: names.entityTypeName })).toBeVisible();

  await addField(page, { key: 'status', label: 'Status', dataType: 'enum' });
  await addField(page, {
    key: 'depends_on',
    label: 'Depends on',
    dataType: 'relation',
    relationTargetTypeKey: names.entityTypeKey,
  });
}

async function addField(page: Page, options: {
  key: string;
  label: string;
  dataType: 'enum' | 'relation';
  relationTargetTypeKey?: string;
}): Promise<void> {
  await page.getByRole('button', { name: /Aggiungi Campo/i }).click();
  await page.getByLabel('Field Key *').fill(options.key);
  await page.getByLabel('Nome Colonna Fisica (DB) *').fill(options.key);
  await page.getByLabel('Tipo di Dato *').selectOption(options.dataType);
  if (options.dataType === 'enum') {
    await page.getByLabel('Gestione opzioni').selectOption('managed');
  } else {
    await page.getByLabel('Dominio di destinazione *').selectOption('entity');
    await expect(page.getByLabel('Chiave del tipo di destinazione *')).toBeEnabled();
    await page.getByLabel('Chiave del tipo di destinazione *').selectOption(options.relationTargetTypeKey!);
  }
  await page.getByLabel('Label (UI) *').fill(options.label);
  await page.getByRole('button', { name: 'Crea Campo' }).click();
  await expect(page.getByText(options.key, { exact: true }).first()).toBeVisible();
}

async function addManagedEnumOption(page: Page, baseUrl: string, names: ScenarioNames): Promise<void> {
  await page.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}/entities/new`);
  await page.getByLabel('Tipo Entità *').selectOption(names.entityTypeKey);
  await expect(page.getByRole('button', { name: '+ Aggiungi opzione' })).toBeVisible();
  await page.getByRole('button', { name: '+ Aggiungi opzione' }).click();
  await page.getByPlaceholder(/Valore tecnico/).fill('planned');
  await page.getByPlaceholder(/Etichetta/).fill('Planned');
  await page.getByRole('button', { name: 'Salva opzione' }).click();
  await expect(page.locator('option[value="planned"]')).toHaveCount(1);
  const release = page.getByRole('button', { name: 'Esci dalla modifica' });
  if (await release.isVisible()) await release.click();
}

async function createOperatorAccess(page: Page, baseUrl: string, names: ScenarioNames): Promise<void> {
  await page.goto(`${baseUrl}/admin/users`);
  await expect(page.getByText(process.env.E2E_ADMIN_EMAIL!, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Registra nuovo utente/i }).click();
  await page.getByLabel('Email Utente').fill(names.operatorEmail);
  const passwordInput = page.getByLabel('Password Iniziale');
  await passwordInput.fill(OPERATOR_PASSWORD);
  await expect(passwordInput).toHaveValue(OPERATOR_PASSWORD);
  await page.getByRole('button', { name: 'Crea Account' }).click();
  await expect(page.getByText(names.operatorEmail, { exact: true })).toBeVisible();
  await page.getByRole('row').filter({ hasText: names.operatorEmail }).getByRole('link', { name: /Dettaglio/i }).click();
  await page.locator('label').filter({ hasText: 'default_reader' }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Salva Ruoli' }).click();
  await expect(page.getByText('Ruoli utente aggiornati con successo.')).toBeVisible();

  await page.goto(`${baseUrl}/admin/security/roles`);
  await page.getByRole('button', { name: /Nuovo Ruolo/i }).click();
  await page.getByLabel('Nome Ruolo *').fill(names.roleName);
  await page.getByLabel('Chiave Ruolo (snake_case) *').fill(names.roleKey);
  await page.getByRole('button', { name: 'Crea Ruolo' }).click();
  await page.getByRole('row').filter({ hasText: names.roleKey }).getByRole('link', { name: /Permessi/i }).click();
  for (const permission of OPERATOR_PERMISSIONS) {
    await page.locator('label').filter({ hasText: permission }).getByRole('checkbox').check();
  }
  await page.getByRole('button', { name: 'Salva Permessi' }).click();
  await expect(page.getByText('Matrice permessi aggiornata con successo.')).toBeVisible();

  await page.goto(`${baseUrl}/admin/security/scopes`);
  await page.getByRole('button', { name: /Nuova assegnazione/i }).click();
  await page.getByLabel('Utente *').selectOption({ label: names.operatorEmail });
  await page.getByLabel('Nodo *').selectOption(ROOT_NODE_ID);
  await page.getByLabel('Ruolo associato allo scope *').selectOption({ label: `${names.roleName} (${names.roleKey})` });
  await page.getByLabel('Effetto *').selectOption('allow');
  await page.getByLabel('Propagazione *').selectOption('subtree');
  await page.getByRole('button', { name: 'Crea assegnazione' }).click();
  await expect(page.getByRole('row').filter({ hasText: names.operatorEmail })).toContainText('Admin parity root');
}

async function ensureEditMode(page: Page): Promise<void> {
  const editMode = page.getByText('Modalità modifica');
  if (await editMode.isVisible()) return;
  const editButton = page.getByRole('button', { name: 'Modifica', exact: true });
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(editMode).toBeVisible();
}

async function createChildNode(page: Page, baseUrl: string, names: ScenarioNames): Promise<string> {
  await page.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
  await ensureEditMode(page);
  await page.getByRole('link', { name: /Sotto-Nodo/ }).first().click();
  await page.getByLabel('Tipo Nodo *').selectOption(names.nodeTypeKey);
  await page.getByLabel('Nome Nodo *').fill(names.childName);
  await page.getByRole('button', { name: 'Crea Sotto-Nodo' }).click();
  await expect(page).toHaveURL(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
  const childLink = page.getByRole('link', { name: names.childName, exact: true }).first();
  await expect(childLink).toBeVisible();
  const href = await childLink.getAttribute('href');
  if (!href) throw new Error('The canonical child node link has no href.');
  return href.split('/').at(-1)!;
}

async function createEntity(page: Page, baseUrl: string, nodeId: string, names: ScenarioNames, entityName: string, relationName?: string): Promise<string> {
  await page.goto(`${baseUrl}/nodes/${nodeId}`);
  await ensureEditMode(page);
  await page.getByRole('link', { name: /Nuova Entità/i }).first().click();
  await page.getByLabel('Tipo Entità *').selectOption(names.entityTypeKey);
  await page.getByLabel('Nome Entità *').fill(entityName);
  await page.locator('select').filter({ has: page.locator('option[value="planned"]') }).selectOption('planned');
  if (relationName) {
    await page.locator('#relation-search-depends_on').fill(relationName);
    const relationSelect = page.locator('#relation-search-depends_on + select');
    await expect(relationSelect.locator('option')).toHaveCount(2);
    await relationSelect.selectOption({ index: 1 });
  }
  await page.getByRole('button', { name: 'Crea Entità' }).click();
  await expect(page).toHaveURL(`${baseUrl}/nodes/${nodeId}`);
  const entityLink = page.getByRole('link', { name: entityName, exact: true }).first();
  await expect(entityLink).toBeVisible();
  const href = await entityLink.getAttribute('href');
  if (!href) throw new Error('The canonical entity link has no href.');
  return new URL(href, baseUrl).toString();
}

async function exerciseConcurrency(firstPage: Page, secondPage: Page, entityUrl: string): Promise<{ lock: boolean; rowVersion: boolean }> {
  await Promise.all([firstPage.goto(entityUrl), secondPage.goto(entityUrl)]);
  await firstPage.getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(firstPage.getByText('Modalità modifica')).toBeVisible();
  await secondPage.getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(secondPage.getByText(/altra sessione|Lock già acquisito|Modifica già in corso/i).first()).toBeVisible();

  await firstPage.getByLabel('Descrizione').fill('Updated by the first canonical session');
  await firstPage.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(firstPage.getByText('Entità aggiornata con successo.')).toBeVisible();

  await secondPage.getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(secondPage.getByText('Modalità modifica')).toBeVisible();
  await secondPage.getByLabel('Descrizione').fill('Stale update from the second canonical session');
  await secondPage.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(secondPage.getByText(/version|conflitto|modificata/i).first()).toBeVisible();
  return { lock: true, rowVersion: true };
}

async function restoreAndAudit(adminPage: Page, baseUrl: string, entityName: string): Promise<{ restored: boolean; actions: string[] }> {
  await adminPage.goto(`${baseUrl}/admin/recycle-bin`);
  const deletedItem = adminPage.getByText(entityName, { exact: true }).locator('..').locator('..');
  await expect(deletedItem).toBeVisible();
  await deletedItem.getByRole('button', { name: 'Ripristina' }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Ripristina' }).click();
  await expect(adminPage.getByText(entityName, { exact: true })).toHaveCount(0);

  await adminPage.goto(`${baseUrl}/admin/audit`);
  const expected = ['node.create', 'entity.create', 'entity.update', 'entity.delete', 'entity.restore'];
  const actions: string[] = [];
  for (const action of expected) {
    await adminPage.getByLabel('Azione (action_key)').fill(action);
    await adminPage.getByRole('button', { name: /Applica Filtri/i }).click();
    await expect(adminPage.locator('td[data-label="Azione"]').filter({ hasText: action }).first()).toBeVisible();
    actions.push(action);
  }
  return { restored: true, actions: actions.sort() };
}

async function closeContexts(contexts: BrowserContext[]): Promise<void> {
  await Promise.all(contexts.map((context) => context.close()));
}

async function exerciseCanonicalVertical(browser: Browser, baseUrl: string, adapter: string): Promise<CanonicalOutcome> {
  const names = scenarioNames(adapter);
  const adminContext = await browser.newContext();
  const firstOperatorContext = await browser.newContext();
  const secondOperatorContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const firstOperatorPage = await firstOperatorContext.newPage();
  const secondOperatorPage = await secondOperatorContext.newPage();

  try {
    await login(adminPage, baseUrl, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
    await createType(adminPage, baseUrl, names);
    await addManagedEnumOption(adminPage, baseUrl, names);
    await createOperatorAccess(adminPage, baseUrl, names);

    await Promise.all([
      login(firstOperatorPage, baseUrl, names.operatorEmail, OPERATOR_PASSWORD),
      login(secondOperatorPage, baseUrl, names.operatorEmail, OPERATOR_PASSWORD),
    ]);
    await expect(firstOperatorPage.getByText('Admin parity root', { exact: true })).toBeVisible();
    await expect(firstOperatorPage.getByText('Outside parity root', { exact: true })).toHaveCount(0);
    await firstOperatorPage.goto(`${baseUrl}/nodes/${OUTSIDE_NODE_ID}`);
    await expect(firstOperatorPage.getByRole('heading', { name: 'Accesso al nodo negato' })).toBeVisible();

    const childNodeId = await createChildNode(firstOperatorPage, baseUrl, names);
    const firstEntityUrl = await createEntity(firstOperatorPage, baseUrl, childNodeId, names, names.firstEntityName);
    const secondEntityUrl = await createEntity(firstOperatorPage, baseUrl, childNodeId, names, names.secondEntityName, names.firstEntityName);

    await firstOperatorPage.goto(secondEntityUrl);
    await expect(firstOperatorPage.getByText('Planned', { exact: true })).toBeVisible();
    await expect(firstOperatorPage.getByRole('link', { name: new RegExp(`^${names.firstEntityName}\\s*→$`) })).toBeVisible();

    const concurrency = await exerciseConcurrency(firstOperatorPage, secondOperatorPage, firstEntityUrl);

    await firstOperatorPage.goto(secondEntityUrl);
    await ensureEditMode(firstOperatorPage);
    await firstOperatorPage.getByRole('button', { name: 'Elimina', exact: true }).click();
    await firstOperatorPage.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
    await expect(firstOperatorPage).toHaveURL(`${baseUrl}/nodes/${childNodeId}`);

    const lifecycle = await restoreAndAudit(adminPage, baseUrl, names.secondEntityName);
    return {
      outsideScopeDenied: true,
      childCreated: true,
      entityCreated: true,
      enumPersisted: true,
      relationPersisted: true,
      lockConflictObserved: concurrency.lock,
      rowVersionConflictObserved: concurrency.rowVersion,
      entityRestored: lifecycle.restored,
      auditActions: lifecycle.actions,
    };
  } finally {
    await closeContexts([adminContext, firstOperatorContext, secondOperatorContext]);
  }
}

test.describe('canonical vertical SQLite/PostgreSQL parity', () => {
  test.skip(!enabled, 'Run through pnpm e2e:canonical to provision both isolated adapters.');
  test.setTimeout(240_000);

  test('completes the scoped operator lifecycle with equivalent outcomes', async ({ browser }) => {
    const [sqlite, postgres] = await Promise.all([
      exerciseCanonicalVertical(browser, process.env.E2E_SQLITE_BASE_URL!, 'sqlite'),
      exerciseCanonicalVertical(browser, process.env.E2E_POSTGRES_BASE_URL!, 'postgres'),
    ]);
    expect(postgres).toEqual(sqlite);
    expect(sqlite).toEqual({
      outsideScopeDenied: true,
      childCreated: true,
      entityCreated: true,
      enumPersisted: true,
      relationPersisted: true,
      lockConflictObserved: true,
      rowVersionConflictObserved: true,
      entityRestored: true,
      auditActions: ['entity.create', 'entity.delete', 'entity.restore', 'entity.update', 'node.create'],
    });
  });
});
