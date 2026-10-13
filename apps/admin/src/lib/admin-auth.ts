import { createRealAdminAuth, getBrowserStore, type AdminAuthClient } from '@eum/api/auth';
import { getAdminApiConfig } from './api-config';

let adminAuthPromise: Promise<AdminAuthClient> | null = null;

// 설정에 맞는 관리자 인증 구현을 만드는 함수. real 빌드에서는 목 인증 chunk가 빠집니다.
async function loadAdminAuth(): Promise<AdminAuthClient> {
  const apiConfig = getAdminApiConfig();
  if (import.meta.env.VITE_API_MODE !== 'real' && apiConfig.mode === 'mock') {
    const { createAdminMockAuth } = await import('@eum/api/mock-auth');
    return createAdminMockAuth(apiConfig, getBrowserStore());
  }
  return createRealAdminAuth(apiConfig);
}

/**
 * 관리자 인증 클라이언트를 한 번만 만들어 돌려주는 함수.
 * 일반 회원 세션과 분리되어 있습니다. 화면의 로그인 확인은 UX일 뿐이며 실제 인가는 서버(HttpOnly 세션)가 합니다.
 */
export function getAdminAuth(): Promise<AdminAuthClient> {
  adminAuthPromise ??= loadAdminAuth().catch((loadError: unknown) => {
    adminAuthPromise = null;
    throw loadError;
  });
  return adminAuthPromise;
}

/** 현재 관리자 조회용 Query 키 */
export const currentAdminQueryKey = ['admin', 'current-user'] as const;
