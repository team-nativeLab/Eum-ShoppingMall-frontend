import { assertBuildApiEnv } from '@eum/api/config';
import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

const isDevelopment = process.env.NODE_ENV === 'development';

/** 설정된 API 주소에서 origin만 뽑습니다. 비었거나 URL이 아니면 null(검증은 assertBuildApiEnv·assertRealApiBaseUrl이 담당). */
function getApiOrigin(): string | null {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!apiBaseUrl) return null;
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * 상품·배너 이미지를 내려주는 별도 호스트(NEXT_PUBLIC_IMAGE_ORIGIN, 선택)의 origin을 돌려주는 함수.
 * 비어 있으면 null이고, URL로 읽을 수 없으면 CSP가 조용히 이미지를 막지 않도록 설정 단계에서 실패시킵니다.
 */
function getImageOrigin(): string | null {
  const imageOriginValue = process.env.NEXT_PUBLIC_IMAGE_ORIGIN?.trim();
  if (!imageOriginValue) return null;
  let imageUrl: URL;
  try {
    imageUrl = new URL(imageOriginValue);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_IMAGE_ORIGIN 값 "${imageOriginValue}"을 URL로 읽을 수 없습니다. 예: https://images.example.com`,
    );
  }
  if (imageUrl.protocol !== 'https:' && imageUrl.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_IMAGE_ORIGIN은 http(s) 주소여야 합니다.');
  }
  return imageUrl.origin;
}

/**
 * Content-Security-Policy 값을 만드는 함수.
 * nonce 방식은 모든 페이지를 요청마다 렌더링하고 proxy를 추가해야 하므로, Next 공식 "Without Nonces" 방식으로
 * 인라인 스크립트(RSC 페이로드·하이드레이션)와 인라인 스타일을 허용합니다.
 * 개발 모드는 React 디버깅용 eval과 HMR 웹소켓만 추가로 허용합니다.
 */
function createContentSecurityPolicy(): string {
  const apiOrigin = getApiOrigin();
  const imageOrigin = getImageOrigin();
  const scriptSources = ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])];
  const connectSources = [
    "'self'",
    ...(apiOrigin ? [apiOrigin] : []),
    ...(isDevelopment ? ['ws:', 'wss:'] : []),
  ];
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${["'self'", 'data:', 'blob:', ...(imageOrigin ? [imageOrigin] : [])].join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

// 모든 경로에 붙이는 보안 헤더
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: createContentSecurityPolicy() },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 응답에 X-Powered-By: Next.js를 넣지 않습니다.
  poweredByHeader: false,
  // 워크스페이스 패키지는 빌드 없이 TypeScript 소스로 배포되므로 Next가 함께 변환합니다.
  transpilePackages: ['@eum/ui', '@eum/api'],
  // next dev가 AGENTS.md를 자동 생성하지 않게 합니다(에이전트 규칙 파일은 사용자가 직접 관리).
  agentRules: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
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
  if (apiConfig.mode === 'real') assertRealApiBaseUrl(apiConfig.baseUrl);
  console.info(`[api-config] web 운영 빌드 API 모드: ${apiConfig.mode}`);
}

/**
 * real 모드 운영 빌드의 API 주소를 검사하는 함수(보안 검토 L2).
 * URL로 읽을 수 있어야 하고 https여야 합니다. 평문 http 주소로 배포되는 것을 빌드 단계에서 막습니다.
 */
function assertRealApiBaseUrl(apiBaseUrl: string): void {
  let parsedApiUrl: URL;
  try {
    parsedApiUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_BASE_URL 값 "${apiBaseUrl}"을 URL로 읽을 수 없습니다. 예: https://api.example.com`,
    );
  }
  if (parsedApiUrl.protocol !== 'https:') {
    throw new Error('real 모드 운영 빌드의 NEXT_PUBLIC_API_BASE_URL은 https 주소여야 합니다.');
  }
}

// `next typegen`도 PHASE_PRODUCTION_BUILD로 설정을 읽지만 타입 생성은 산출물을 만들지 않으므로 검증하지 않습니다.
const isTypegenCommand = process.argv[2] === 'typegen';

export default function createNextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !isTypegenCommand) assertProductionApiConfig();
  return nextConfig;
}
