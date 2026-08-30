import { expect, test, type Page } from "@playwright/test";

/** Enables the focused browser check only when explicit credentials are provided. */
const enabled = process.env.E2E_NODE_TREE_RUN === "true" &&
  Boolean(process.env.E2E_ADMIN_EMAIL) &&
  Boolean(process.env.E2E_ADMIN_PASSWORD);

/** Authenticates an administrator without persisting credentials in test assets. */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(
    process.env.E2E_ADMIN_EMAIL!,
  );
  await page.locator('input[name="password"]').fill(
    process.env.E2E_ADMIN_PASSWORD!,
  );
  await page.getByRole("button", { name: /Accedi|Sign in/i }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("definition-driven node tree selector", () => {
  test.skip(
    !enabled,
    "Set E2E_NODE_TREE_RUN and the administrator credentials to run this test.",
  );

  test("supports drag, direct selection, and draft restoration", async ({ page }) => {
    await login(page);
    await page.goto("/admin/access/scopes");
    await page.getByRole("button", {
      name: /^\+?\s*(Crea ambito|Create scope)$/i,
    }).click();

    const field = page.locator('[data-node-tree-field="nodeId"]');
    const source = field.locator("[data-node-id]").first();
    const dropTarget = field.locator("[data-node-tree-drop-target]");
    const nodeId = await source.getAttribute("data-node-id");
    expect(nodeId).toBeTruthy();

    await source.dragTo(dropTarget);
    await expect(dropTarget).toHaveAttribute("data-selected-node-id", nodeId!);
    await expect(field.locator('input[name="nodeId"]')).toHaveValue(nodeId!);

    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    const restoredField = page.locator('[data-node-tree-field="nodeId"]');
    await expect(restoredField.locator("[data-node-tree-drop-target]"))
      .toHaveAttribute("data-selected-node-id", nodeId!);

    await restoredField.locator(`[data-node-id="${nodeId}"]`).click();
    await expect(restoredField.locator('input[name="nodeId"]'))
      .toHaveValue(nodeId!);
  });

  test("restores multiple user scope rows and their selected nodes", async ({ page }) => {
    await login(page);
    await page.goto("/admin/access/users");
    await page.getByRole("button", {
      name: /^\+?\s*(Crea utente|Create user)$/i,
    }).click();
    await page.getByRole("button", {
      name: /Aggiungi assegnazione|Add assignment/i,
    }).click();

    const fields = page.locator("[data-node-tree-field]");
    await expect(fields).toHaveCount(2);

    const firstField = fields.nth(0);
    const secondField = fields.nth(1);
    const firstNode = firstField.locator("[data-node-id]").first();
    const secondNode = secondField.locator("[data-node-id]").first();
    const firstNodeId = await firstNode.getAttribute("data-node-id");
    const secondNodeId = await secondNode.getAttribute("data-node-id");
    expect(firstNodeId).toBeTruthy();
    expect(secondNodeId).toBeTruthy();

    await firstNode.dragTo(firstField.locator("[data-node-tree-drop-target]"));
    await expect(firstField.locator("[data-node-tree-drop-target]"))
      .toHaveAttribute("data-selected-node-id", firstNodeId!);
    await secondNode.click();
    await expect(secondField.locator("[data-node-tree-drop-target]"))
      .toHaveAttribute("data-selected-node-id", secondNodeId!);

    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    const restoredFields = page.locator("[data-node-tree-field]");
    await expect(restoredFields).toHaveCount(2);
    await expect(restoredFields.nth(0).locator("[data-node-tree-drop-target]"))
      .toHaveAttribute("data-selected-node-id", firstNodeId!);
    await expect(restoredFields.nth(1).locator("[data-node-tree-drop-target]"))
      .toHaveAttribute("data-selected-node-id", secondNodeId!);
  });
});
