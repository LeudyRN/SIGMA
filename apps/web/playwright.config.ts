import { defineConfig, devices } from '@playwright/test';

const browserChannel = process.env.PLAYWRIGHT_CHANNEL as 'chrome' | 'msedge' | undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(browserChannel ? { channel: browserChannel } : {}) },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], ...(browserChannel ? { channel: browserChannel } : {}) },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
