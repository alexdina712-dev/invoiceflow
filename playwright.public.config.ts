import { defineConfig } from '@playwright/test';
import config from './playwright.config';
const url = process.env.PUBLIC_DEMO_URL;
if (!url || !url.startsWith('https://'))
  throw new Error('Set PUBLIC_DEMO_URL to the HTTPS deployment.');
export default defineConfig({
  ...config,
  webServer: undefined,
  timeout: 90000,
  expect: { timeout: 30000 },
  use: { ...config.use, baseURL: url },
  retries: 0,
});
