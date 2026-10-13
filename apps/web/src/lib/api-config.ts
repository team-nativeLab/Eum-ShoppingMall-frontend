import { resolveApiConfig, type ApiConfig } from '@eum/api/config';

let cachedApiConfig: ApiConfig | null = null;

/**
 * web 앱의 API 설정을 읽어 검증하는 함수(한 번만 계산).
 * Next는 NEXT_PUBLIC_* 를 빌드 시점에 문자열로 바꿔 넣으므로 process.env.이름 형태로 그대로 읽어야 합니다.
 * 같은 검증을 next.config.ts가 빌드 시점에도 수행하므로, 운영 빌드의 잘못된 설정은 빌드에서 먼저 실패합니다.
 */
export function getWebApiConfig(): ApiConfig {
  cachedApiConfig ??= resolveApiConfig({
    mode: process.env.NEXT_PUBLIC_API_MODE,
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    mockScenario: process.env.NEXT_PUBLIC_MOCK_SCENARIO,
    allowMockInProduction: process.env.NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION,
    isProduction: process.env.NODE_ENV === 'production',
  });
  return cachedApiConfig;
}
