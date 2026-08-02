import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config vite.config.test.ts',
    port: 5173,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
