import { assertBuildApiEnv } from '@eum/api/config';
import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 패키지는 빌드 없이 TypeScript 소스로 배포되므로 Next가 함께 변환합니다.
  transpilePackages: ['@eum/ui', '@eum/api'],
  // next dev가 AGENTS.md를 자동 생성하지 않게 합니다(에이전트 규칙 파일은 사용자가 직접 관리).
  agentRules: false,
};

/**
 * 운영 빌드 시점에 API 설정을 검증하는 함수. 런타임(src/lib/api-config.ts)과 같은 resolveApiConfig를 씁니다.
 * 모드 미지정, mock인데 NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION=true 없음, real인데 baseUrl 없음이면 빌드를 실패시킵니다.
 */
function assertProductionApiConfig(): void {
  const apiConfig = assertBuildApiEnv({
    mode: process.env.NEXT_PUBLIC_API_MODE,
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    mockScenario: process.env.NEXT_PUBLIC_MOCK_SCENARIO,
    allowMockInProduction: process.env.NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION,
    isProduction: true,
  });
  console.info(`[api-config] web 운영 빌드 API 모드: ${apiConfig.mode}`);
}

// `next typegen`도 PHASE_PRODUCTION_BUILD로 설정을 읽지만 타입 생성은 산출물을 만들지 않으므로 검증하지 않습니다.
const isTypegenCommand = process.argv[2] === 'typegen';

export default function createNextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !isTypegenCommand) assertProductionApiConfig();
  return nextConfig;
}
