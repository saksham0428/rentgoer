import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for RentGoer.
 * Uses locally installed Google Chrome in headless mode.
 * Enforces strictly local execution with zero live backend/database dependencies.
 * Automatically starts the guarded test backend (connecting only to local rentgoer_test)
 * and the Next.js production test frontend server.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Deterministic sequential execution
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start:test',
      cwd: '../backend',
      url: 'http://localhost:5001/api/health',
      reuseExistingServer: false,
      timeout: 30 * 1000,
      env: {
        PORT: '5001',
        TEST_PORT: '5001',
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:3100',
        JWT_SECRET: 'test-jwt-secret-rentgoer-guarded-test-environment-min-32-chars',
      },
    },
    {
      command: 'npx next start -p 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: false,
      timeout: 60 * 1000,
      env: {
        PORT: '3100',
        NODE_ENV: 'production',
        RENTGOER_TEST_MODE: 'true',
        NEXT_PUBLIC_API_URL: '/api/proxy',
        NEXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:5001',
      },
    },
  ],
});
