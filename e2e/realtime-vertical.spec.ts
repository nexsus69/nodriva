/** Verifies websocket locks and durable node updates across two browser sessions. */
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';

const enabled = process.env.E2E_REALTIME_RUN === 'true';
const nodeId = '70000000-0000-0000-0000-000000000002';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('propagates locks and a committed node update without reloading the observer', async ({ browser, baseURL }) => {
  test.skip(!enabled, 'Run through pnpm e2e:realtime with isolated PostgreSQL and Soketi.');
  test.setTimeout(60_000);
  const url = process.env.E2E_POSTGRES_DATABASE_URL;
  if (!url || !/(?:^|_)test(?:_|$)/.test(new URL(url).pathname.slice(1))) throw new Error('An isolated test database is required.');
  const pool = new pg.Pool({ connectionString: url });
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  const editor = await first.newPage();
  const observer = await second.newPage();
  const received: string[] = [];
  observer.on('websocket', (socket) => socket.on('framereceived', ({ payload }) => received.push(String(payload))));
  try {
    await Promise.all([login(editor), login(observer)]);
    received.length = 0;
    await Promise.all([editor.goto(`/nodes/${nodeId}`), observer.goto(`/nodes/${nodeId}`)]);
    await expect.poll(() => received.some((frame) => frame.includes('subscription_succeeded') && frame.includes('lock'))).toBe(true);
    await expect.poll(() => received.some((frame) => frame.includes('subscription_succeeded') && !frame.includes('lock'))).toBe(true);
    let observerNavigations = 0;
    observer.on('framenavigated', (frame) => { if (frame === observer.mainFrame()) observerNavigations += 1; });

    await editor.getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(editor.getByText('Modalità modifica', { exact: true })).toBeVisible();
    await expect(observer.getByText(/Modifica già in corso da un[’']altra sessione/)).toBeVisible();
    await expect.poll(() => received.some((frame) => frame.includes('lock:acquired') && frame.includes(nodeId))).toBe(true);
    await editor.getByRole('button', { name: 'Esci dalla modifica' }).click();
    await expect(observer.getByRole('button', { name: 'Modifica', exact: true })).toBeVisible();
    await expect.poll(() => received.some((frame) => frame.includes('lock:released') && frame.includes(nodeId))).toBe(true);

    await editor.getByRole('button', { name: 'Modifica', exact: true }).click();
    await editor.locator('textarea[name="description"]').fill('Realtime browser update');
    await editor.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(editor.getByText('Salvataggio completato.', { exact: true })).toBeVisible();
    await expect.poll(async () => (await pool.query(
      "SELECT event_payload FROM realtime_event_outbox WHERE event_payload->>'resourceId'=$1 AND event_payload->>'changeType'='updated' ORDER BY created_at DESC LIMIT 1", [nodeId],
    )).rows[0]?.event_payload).toMatchObject({
      resourceId: nodeId,
      data: { description: 'Realtime browser update' },
    });
    await expect.poll(() => received.some((frame) => frame.includes('data:changed') && frame.includes(nodeId) && frame.includes('Realtime browser update'))).toBe(true);
    await expect(observer.getByText('Realtime browser update', { exact: true })).toBeVisible();
    expect(observerNavigations).toBe(0);
    await expect.poll(async () => Number((await pool.query(
      "SELECT COUNT(*) FROM realtime_event_outbox WHERE event_payload->>'resourceId'=$1 AND event_payload->>'changeType'='updated' AND published_at IS NOT NULL", [nodeId],
    )).rows[0].count)).toBeGreaterThan(0);
    const endpoint = '/api/internal/realtime/drain';
    expect((await editor.request.post(endpoint)).status()).toBe(401);
    expect((await editor.request.post(endpoint, {
      headers: { authorization: `Bearer ${process.env.REALTIME_WORKER_SECRET}` },
    })).ok()).toBe(true);
  } finally {
    await first.close();
    await second.close();
    await pool.end();
  }
});
