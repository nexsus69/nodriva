import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? process.env.DASHBOARD_PUBLIC_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...(baseURL ? { baseURL } : {}),
    browserName: 'chromium',
    channel: process.env.E2E_BROWSER_CHANNEL,
    launchOptions: process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
