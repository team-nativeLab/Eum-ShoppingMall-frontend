import { resolveApiConfig, type ApiConfig } from '@eum/api/config';

let cachedApiConfig: ApiConfig | null = null;

/**
 * admin 앱의 API 설정을 읽어 검증하는 함수(한 번만 계산).
 * 같은 검증을 vite.config.ts가 빌드 시점에도 수행하므로, 운영 빌드의 잘못된 설정은 빌드에서 먼저 실패합니다.
 */
export function getAdminApiConfig(): ApiConfig {
  cachedApiConfig ??= resolveApiConfig({
    mode: import.meta.env.VITE_API_MODE,
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    mockScenario: import.meta.env.VITE_MOCK_SCENARIO,
    allowMockInProduction: import.meta.env.VITE_ALLOW_MOCK_IN_PRODUCTION,
    isProduction: import.meta.env.PROD,
  });
  return cachedApiConfig;
}
