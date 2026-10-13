import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const domSetupFile = fileURLToPath(new URL('./test/setup-dom.ts', import.meta.url));

// 앱별 "@/" 별칭(각 tsconfig paths와 같음)
const srcAlias = (appDir: string) => ({
  '@': fileURLToPath(new URL(`./${appDir}/src`, import.meta.url)),
});

/**
 * 모노레포 단위 테스트 설정. 패키지마다 project를 나눠 환경(node/jsdom)을 다르게 씁니다.
 * Playwright E2E(e2e/**)와 빌드 산출물은 제외합니다.
 */
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'e2e/**'],
    projects: [
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['packages/api/src/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['packages/ui/src/**/*.test.{ts,tsx}'],
          setupFiles: [domSetupFile],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias('apps/web') },
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          setupFiles: [domSetupFile],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias('apps/admin') },
        test: {
          name: 'admin',
          environment: 'jsdom',
          include: ['apps/admin/src/**/*.test.{ts,tsx}'],
          setupFiles: [domSetupFile],
        },
      },
    ],
  },
});
