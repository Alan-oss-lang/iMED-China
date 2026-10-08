import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8766', headless: true, launchOptions: process.env.IMED_BROWSER_PATH ? { executablePath: process.env.IMED_BROWSER_PATH } : {}, screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/browser-server.mjs', url: 'http://127.0.0.1:8766/api/health', reuseExistingServer: false, timeout: 15000 },
});
