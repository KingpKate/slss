import { defineConfig, devices } from '@playwright/test';

/**
 * Admin console smoke configuration. Install @playwright/test in CI and run
 * with SLSS_E2E_URL pointing at the deployed web application.
 */
export default defineConfig({
  testDir: './deploy/e2e/playwright',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.SLSS_E2E_URL || 'http://127.0.0.1:8080/slss/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});
