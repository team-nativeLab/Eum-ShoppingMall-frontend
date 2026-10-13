import { fileURLToPath } from 'node:url';
import { assertBuildApiEnv } from '@eum/api/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * 운영 빌드 시점에 API 설정을 검증하는 함수. 런타임(src/lib/api-config.ts)과 같은 resolveApiConfig를 씁니다.
 * 모드 미지정, mock인데 VITE_ALLOW_MOCK_IN_PRODUCTION=true 없음, real인데 baseUrl 없음이면 빌드를 실패시킵니다.
 * --mode staging 등 어떤 모드로 빌드하든 검사합니다. 운영 여부는 런타임 import.meta.env.PROD와 같은 기준(NODE_ENV,
 * vite build 기본값 production)으로 정합니다.
 */
function assertBuildApiConfig(viteMode: string): void {
  // .env 파일 값보다 셸 환경변수가 우선합니다(Vite 규칙과 같음).
  const fileEnv = loadEnv(viteMode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  const readEnv = (envName: string) => process.env[envName] ?? fileEnv[envName];
  const isProduction = (process.env.NODE_ENV ?? 'production') === 'production';
  const apiConfig = assertBuildApiEnv({
    mode: readEnv('VITE_API_MODE'),
    baseUrl: readEnv('VITE_API_BASE_URL'),
    mockScenario: readEnv('VITE_MOCK_SCENARIO'),
    allowMockInProduction: readEnv('VITE_ALLOW_MOCK_IN_PRODUCTION'),
    isProduction,
  });
  console.info(`[api-config] admin 빌드(${viteMode}) API 모드: ${apiConfig.mode}`);
}

// admin SPA 설정. Tailwind v4는 Vite 플러그인으로 처리하고, "@/"는 src를 가리킵니다(tsconfig paths와 같음).
export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertBuildApiConfig(mode);
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
