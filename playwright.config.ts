import { defineConfig, devices } from '@playwright/test';

const WEB_BASE_URL = 'http://localhost:3000';
const ADMIN_BASE_URL = 'http://localhost:5173';

/**
 * E2E·시각 확인 설정. 데스크톱 1440(기본)과 모바일웹 390 프로젝트를 둡니다.
 * 브라우저는 `npx playwright install chromium`으로 따로 설치하며, workflow_dispatch에서 캡처를 만듭니다.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'on-first-retry', screenshot: 'on', locale: 'ko-KR' },
  projects: [
    {
      name: 'web-desktop',
      testMatch: /web\..*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE_URL,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'web-mobile',
      testMatch: /web\..*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE_URL,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'admin-desktop',
      testMatch: /admin\..*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ADMIN_BASE_URL,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:web',
      url: WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:admin',
      url: ADMIN_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
