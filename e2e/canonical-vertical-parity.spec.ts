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
  inverseRelationReplacementReviewed: boolean;
  lockConflictObserved: boolean;
  rowVersionConflictObserved: boolean;
  breadcrumbReloaded: boolean;
  entityRestored: boolean;
  nodeDeletedViaMenu: boolean;
  subtreeRecycleOperation: boolean;
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
  thirdEntityName: string;
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
    thirdEntityName: `Canonical task C ${adapter}`,
  };
}

async function login(page: Page, baseUrl: string, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^Accedi$/ }).click();
  await expect(page).toHaveURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`));
}

/** Selects one option from the application-owned combobox used by every form. */
async function selectApplicationOption(
  page: Page,
  label: string | RegExp,
  option: string | RegExp,
): Promise<void> {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}

/** Waits for a navigated Next.js screen to load the client code that owns its controls. */
async function waitForClientControls(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

async function createType(page: Page, baseUrl: string, names: ScenarioNames): Promise<void> {
  await page.goto(`${baseUrl}/admin/model/types`);
  await expect(page.getByRole('row').filter({ hasText: 'admin_parity_root' })).toBeVisible();
  await page.getByRole('button', { name: /^\+?\s*Crea tipo(?: nodo| entità)?$/i }).click();
  await page.getByLabel('Chiave tipo *').fill(names.nodeTypeKey);
  await page.getByLabel('Nome *').fill(names.nodeTypeName);
  await expect(page.getByLabel('Nome *')).toHaveValue(names.nodeTypeName);
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Crea tipo' }).click();
  await expect(page.getByText(names.nodeTypeKey, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Tipi entità|Entity types/i }).click();
  await page.getByRole('button', { name: /^\+?\s*Crea tipo(?: nodo| entità)?$/i }).click();
  await page.getByLabel('Chiave tipo *').fill(names.entityTypeKey);
  await page.getByLabel('Nome *').fill(names.entityTypeName);
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByLabel('Tabella storage *').fill(`entity_${names.entityTypeKey}`);
  await expect(page.getByLabel('Tabella storage *')).toHaveValue(`entity_${names.entityTypeKey}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Crea tipo' }).click();
  await page.getByRole('row', { name: names.entityTypeName }).click();
  await expect(page.getByRole('heading', { name: names.entityTypeName })).toBeVisible();
  await page.getByRole('button', { name: /^Campi \(\d+\)$/ }).click();

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
  await page.getByRole('button', { name: /Aggiungi campo/i }).click();
  await page.getByLabel('Chiave campo *').fill(options.key);
  await page.getByLabel('Nome colonna *').fill(options.key);
  await selectApplicationOption(
    page,
    /Tipo dato/,
    options.dataType === 'enum' ? /^(Scelta|Choice)(?:\s|$)/ : /^(Relazione|Relationship)(?:\s|$)/,
  );
  if (options.dataType === 'enum') {
    await selectApplicationOption(page, /Modalità enum/, /Opzioni gestite/);
  } else {
    await selectApplicationOption(page, /Dominio relazione/, /Tipi entità/);
    await page.getByLabel(/Chiave tipo relazione/).fill(options.relationTargetTypeKey!);
  }
  await page.getByLabel('Etichetta *').fill(options.label);
  await page.getByRole('button', { name: 'Aggiungi campo', exact: true }).click();
  await expect(page.getByText(options.key, { exact: true }).first()).toBeVisible();
}

async function addManagedEnumOption(page: Page, baseUrl: string, names: ScenarioNames): Promise<void> {
  await page.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}/entities/new`);
  await selectApplicationOption(
    page,
    'Tipo Entità *',
    new RegExp(names.entityTypeKey),
  );
  await expect(page.getByRole('button', { name: '+ Aggiungi opzione' })).toBeVisible();
  await page.getByRole('button', { name: '+ Aggiungi opzione' }).click();
  await page.getByPlaceholder(/Valore tecnico/).fill('planned');
  await page.getByPlaceholder(/Etichetta/).fill('Planned');
  await page.getByRole('button', { name: 'Salva opzione' }).click();
  await page.getByRole('combobox', { name: 'Status' }).click();
  await expect(page.getByRole('option', { name: 'Planned', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const release = page.getByRole('button', { name: 'Esci dalla modifica' });
  if (await release.isVisible()) await release.click();
}

async function createOperatorAccess(page: Page, baseUrl: string, names: ScenarioNames): Promise<void> {
  await page.goto(`${baseUrl}/admin/access/roles`);
  await page.getByRole('button', { name: /^\+?\s*Crea ruolo$/i }).click();
  await page.getByLabel('Nome *').fill(names.roleName);
  await expect(page.getByLabel('Chiave ruolo *')).toHaveValue(names.roleKey);
  await page.getByRole('dialog').getByRole('button', { name: 'Crea ruolo' }).click();
  await page.getByRole('row', { name: names.roleName }).click();
  const permissionLabels: Record<(typeof OPERATOR_PERMISSIONS)[number], RegExp> = {
    'node.read': /Nodo.*Lettura/i,
    'node.create': /Nodo.*Creazione/i,
    'node.edit': /Nodo.*Modifica/i,
    'node.delete': /Nodo.*Eliminazione/i,
    'node.restore': /Nodo.*Ripristino/i,
    'entity.read': /Entità.*Lettura/i,
    'entity.create': /Entità.*Creazione/i,
    'entity.edit': /Entità.*Modifica/i,
    'entity.delete': /Entità.*Eliminazione/i,
    'entity.restore': /Entità.*Ripristino/i,
  };
  for (const permission of OPERATOR_PERMISSIONS) {
    await page.getByRole('switch', { name: permissionLabels[permission] }).first().click();
  }
  await page.getByRole('button', { name: 'Salva permessi' }).click();

  await page.goto(`${baseUrl}/admin/access/users`);
  await expect(page.getByRole('table').getByText(process.env.E2E_ADMIN_EMAIL!, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^\+?\s*Crea utente$/i }).click();
  await expect(
    page.locator('[data-node-tree-field="assignment.1.nodeId"]'),
  ).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Email *').fill(names.operatorEmail);
  const passwordInput = page.getByLabel('Password *');
  await passwordInput.fill(OPERATOR_PASSWORD);
  await expect(passwordInput).toHaveValue(OPERATOR_PASSWORD);
  await selectApplicationOption(page, /Ruolo \*/, names.roleName);
  await page.locator('[data-node-tree-field="assignment.1.nodeId"] [data-node-id]').filter({ hasText: 'Admin parity root' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Crea utente' }).click();
  await expect(page.getByText(names.operatorEmail, { exact: true })).toBeVisible();
}

async function createChildNode(page: Page, baseUrl: string, names: ScenarioNames): Promise<string> {
  await page.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
  await expect(page.getByText('Modalità modifica')).toHaveCount(0);
  await page.getByRole('link', { name: /Sotto-Nodo/ }).first().click();
  await selectApplicationOption(
    page,
    'Tipo Nodo *',
    new RegExp(names.nodeTypeKey),
  );
  await page.getByLabel('Nome Nodo *').fill(names.childName);
  await page.getByRole('button', { name: 'Crea Sotto-Nodo' }).click();
  await expect(page).toHaveURL(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
  await expect(page.getByText('Modalità modifica')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Modifica', exact: true })).toBeEnabled();
  const childLink = page.getByRole('link', { name: names.childName, exact: true }).first();
  await expect(childLink).toBeVisible();
  const href = await childLink.getAttribute('href');
  if (!href) throw new Error('The canonical child node link has no href.');
  return href.split('/').at(-1)!;
}

async function openChildCreationFromMenu(page: Page, childName: string, action: 'Nuovo sotto-nodo' | 'Nuova entità'): Promise<void> {
  const trigger = page.getByRole('button', { name: `Azioni per ${childName}` });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menuItem = page.getByRole('menuitem', { name: action });
  await expect(menuItem).toBeVisible();
  await menuItem.click();
}

async function createEntity(page: Page, baseUrl: string, nodeId: string, names: ScenarioNames, entityName: string, relationName?: string, originNodeId = nodeId): Promise<string> {
  await page.goto(`${baseUrl}/nodes/${originNodeId}`);
  await expect(page.getByText('Modalità modifica')).toHaveCount(0);
  if (originNodeId === nodeId) {
    await page.getByRole('link', { name: /Nuova Entità/i }).first().click();
  } else {
    await openChildCreationFromMenu(page, names.childName, 'Nuova entità');
  }
  await selectApplicationOption(
    page,
    'Tipo Entità *',
    new RegExp(names.entityTypeKey),
  );
  await page.getByLabel('Nome Entità *').fill(entityName);
  await selectApplicationOption(page, 'Status', 'Planned');
  if (relationName) {
    const relationPicker = page.locator('[data-relation-picker="depends_on"]');
    await relationPicker.locator('#relation-search-depends_on').fill(relationName);
    await relationPicker.locator('#relation-select-depends_on').click();
    await page.getByRole('option', { name: new RegExp(relationName) }).click();
  }
  const createButton = page.getByRole('button', { name: 'Crea Entità' });
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await expect(page).toHaveURL(`${baseUrl}/nodes/${originNodeId}`);
  await expect(page.getByText('Modalità modifica')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Modifica', exact: true })).toBeEnabled();
  if (originNodeId !== nodeId) {
    await page.goto(`${baseUrl}/nodes/${nodeId}`);
    await expect(page.getByText('Modalità modifica')).toHaveCount(0);
  }
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

/** Exercises the inverse relation preview before replacing an existing single value. */
async function exerciseInverseRelationReplacementReview(
  page: Page,
  secondEntityUrl: string,
  names: ScenarioNames,
): Promise<boolean> {
  await page.goto(secondEntityUrl);
  await page.getByRole('button', { name: 'Gestisci collegamenti' }).click();
  const picker = page.locator('[data-relation-picker^="inverse-"]');
  await picker.locator('input').fill(names.thirdEntityName);
  await picker.getByRole('checkbox', { name: new RegExp(names.thirdEntityName) }).click();
  await page.getByRole('button', { name: 'Verifica modifiche' }).click();
  await expect(page.getByRole('heading', { name: 'Verifica modifiche alla relazione' })).toBeVisible();
  await expect(page.getByText('I collegamenti esistenti verranno sostituiti')).toBeVisible();
  await page.getByRole('button', { name: 'Conferma sostituzione' }).click();
  await expect(page.getByRole('link', { name: new RegExp(names.thirdEntityName) })).toBeVisible();
  return true;
}

async function restoreAndAudit(adminPage: Page, baseUrl: string, entityName: string): Promise<{ restored: boolean; actions: string[] }> {
  await adminPage.goto(`${baseUrl}/admin/governance/recycle-bin`);
  const deletedItem = adminPage.getByRole('row').filter({ hasText: entityName });
  await expect(deletedItem).toBeVisible();
  await deletedItem.getByRole('button', { name: /Azioni|Actions/i }).click();
  await adminPage.getByRole('menuitem', { name: 'Ripristina' }).click();
  await adminPage.getByRole('alertdialog').getByRole('button', { name: 'Ripristina' }).click();
  await expect(adminPage.getByText(entityName, { exact: true })).toHaveCount(0);

  await adminPage.goto(`${baseUrl}/admin/governance/audit`);
  await waitForClientControls(adminPage);
  const expected = ['node.create', 'entity.create', 'entity.update', 'entity.delete', 'entity.restore'];
  const semanticLabels: Record<string, RegExp> = {
    'node.create': /Nodo · Creazione/,
    'entity.create': /Entità · Creazione/,
    'entity.update': /Aggiornamento entità/,
    'entity.delete': /Entità · Eliminazione/,
    'entity.restore': /Entità · Ripristino/,
  };
  const actions: string[] = [];
  for (const action of expected) {
    const actionFilter = adminPage.getByRole('combobox', { name: 'Azione', exact: true });
    await actionFilter.click();
    await adminPage.getByRole('option', { name: new RegExp(action.replace('.', '\\.')) }).click();
    await adminPage.getByRole('button', { name: /Applica Filtri/i }).click();
    await expect(adminPage.getByRole('row').filter({ hasText: semanticLabels[action]! }).first()).toBeVisible();
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
    await firstOperatorPage.goto(`${baseUrl}/nodes/${childNodeId}`);
    await firstOperatorPage.reload();
    const nodeBreadcrumb = firstOperatorPage.getByRole('navigation', { name: 'Breadcrumb nodi' });
    await expect(nodeBreadcrumb).toContainText('Admin parity root');
    await expect(nodeBreadcrumb).toContainText(names.childName);
    await expect(nodeBreadcrumb).not.toContainText(/Catena in caricamento|Breadcrumb non disponibile/);

    await firstOperatorPage.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
    await openChildCreationFromMenu(firstOperatorPage, names.childName, 'Nuovo sotto-nodo');
    await firstOperatorPage.getByRole('button', { name: 'Annulla' }).click();
    await expect(firstOperatorPage).toHaveURL(`${baseUrl}/nodes/${ROOT_NODE_ID}`);

    const firstEntityUrl = await createEntity(firstOperatorPage, baseUrl, childNodeId, names, names.firstEntityName, undefined, ROOT_NODE_ID);
    const secondEntityUrl = await createEntity(firstOperatorPage, baseUrl, childNodeId, names, names.secondEntityName, names.firstEntityName);
    await createEntity(firstOperatorPage, baseUrl, childNodeId, names, names.thirdEntityName, names.firstEntityName);

    const inverseRelationReplacementReviewed = await exerciseInverseRelationReplacementReview(
      firstOperatorPage,
      secondEntityUrl,
      names,
    );

    await firstOperatorPage.goto(secondEntityUrl);
    await firstOperatorPage.reload();
    const entityBreadcrumb = firstOperatorPage.getByRole('navigation', { name: 'Breadcrumb nodi' });
    await expect(entityBreadcrumb).toContainText('Admin parity root');
    await expect(entityBreadcrumb).toContainText(names.childName);
    await expect(entityBreadcrumb).not.toContainText(/Catena in caricamento|Breadcrumb non disponibile/);
    await expect(firstOperatorPage.getByText('Planned', { exact: true })).toBeVisible();
    await expect(firstOperatorPage.getByRole('link', { name: new RegExp(`^${names.firstEntityName}\\s*→$`) })).toBeVisible();

    const concurrency = await exerciseConcurrency(firstOperatorPage, secondOperatorPage, firstEntityUrl);

    await firstOperatorPage.goto(secondEntityUrl);
    await firstOperatorPage.getByRole('button', { name: `Azioni per ${names.secondEntityName}` }).click();
    await firstOperatorPage.getByRole('menuitem', { name: 'Elimina entità' }).click();
    await firstOperatorPage.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click();
    await expect(firstOperatorPage).toHaveURL(`${baseUrl}/nodes/${childNodeId}`);

    const lifecycle = await restoreAndAudit(adminPage, baseUrl, names.secondEntityName);
    await firstOperatorPage.goto(`${baseUrl}/nodes/${childNodeId}`);
    await firstOperatorPage.locator('h1').getByRole('button', { name: `Azioni per ${names.childName}` }).click();
    await firstOperatorPage.getByRole('menuitem', { name: 'Elimina nodo' }).click();
    await firstOperatorPage.getByRole('alertdialog').getByRole('button', { name: 'Elimina nodo' }).click();
    await expect(firstOperatorPage).toHaveURL(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
    await expect(firstOperatorPage.getByRole('link', { name: names.childName, exact: true })).toHaveCount(0);

    await adminPage.goto(`${baseUrl}/admin/governance/recycle-bin`);
    const subtreeOperation = adminPage.getByRole('row').filter({ hasText: names.childName });
    await expect(subtreeOperation).toContainText('Nodo e contenuto');
    await expect(adminPage.getByText(names.firstEntityName, { exact: true })).toHaveCount(0);
    await expect(adminPage.getByText(names.thirdEntityName, { exact: true })).toHaveCount(0);
    await subtreeOperation.getByRole('button', { name: /Azioni|Actions/i }).click();
    await adminPage.getByRole('menuitem', { name: 'Ripristina tutto' }).click();
    await adminPage.getByRole('alertdialog').getByRole('button', { name: 'Ripristina tutto' }).click();
    await expect(adminPage.getByText(names.childName, { exact: true })).toHaveCount(0);
    await firstOperatorPage.goto(`${baseUrl}/nodes/${ROOT_NODE_ID}`);
    await expect(firstOperatorPage.getByRole('link', { name: names.childName, exact: true })).toBeVisible();

    return {
      outsideScopeDenied: true,
      childCreated: true,
      entityCreated: true,
      enumPersisted: true,
      relationPersisted: true,
      inverseRelationReplacementReviewed,
      lockConflictObserved: concurrency.lock,
      rowVersionConflictObserved: concurrency.rowVersion,
      breadcrumbReloaded: true,
      entityRestored: lifecycle.restored,
      nodeDeletedViaMenu: true,
      subtreeRecycleOperation: true,
      auditActions: lifecycle.actions,
    };
  } finally {
    await closeContexts([adminContext, firstOperatorContext, secondOperatorContext]);
  }
}

test.describe('canonical vertical SQLite/PostgreSQL parity', () => {
  test.skip(!enabled, 'Run through pnpm e2e:canonical to provision both isolated adapters.');
  // Two fully isolated adapters execute the complete lifecycle concurrently.
  // Keep the timeout above the normal combined cold-start budget without
  // weakening individual UI expectations, which retain their short defaults.
  test.setTimeout(300_000);

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
      inverseRelationReplacementReviewed: true,
      lockConflictObserved: true,
      rowVersionConflictObserved: true,
      breadcrumbReloaded: true,
      entityRestored: true,
      nodeDeletedViaMenu: true,
      subtreeRecycleOperation: true,
      auditActions: ['entity.create', 'entity.delete', 'entity.restore', 'entity.update', 'node.create'],
    });
  });
});
