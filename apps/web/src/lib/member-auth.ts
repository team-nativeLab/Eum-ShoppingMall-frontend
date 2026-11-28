import {
  createRealMemberAuth,
  getBrowserStore,
  type MemberAuthClientWithSignup,
} from '@eum/api/auth';
import { getWebApiConfig } from './api-config';
import { createRealUnifiedAuth, type UnifiedAuthClient } from '@eum/api/unified-auth';

let memberAuthPromise: Promise<MemberAuthClientWithSignup> | null = null;
let unifiedAuthPromise: Promise<UnifiedAuthClient> | null = null;

// 설정에 맞는 일반 회원 인증 구현을 만드는 함수. real 빌드에서는 목 인증 chunk가 빠집니다.
async function loadMemberAuth(): Promise<MemberAuthClientWithSignup> {
  const apiConfig = getWebApiConfig();
  if (process.env.NEXT_PUBLIC_API_MODE !== 'real' && apiConfig.mode === 'mock') {
    const { createMemberMockAuth } = await import('@eum/api/mock-auth');
    return createMemberMockAuth(apiConfig, getBrowserStore());
  }
  return createRealMemberAuth(apiConfig);
}

/**
 * 브라우저에서 회원 인증 클라이언트를 공유합니다. SSR 호출은 사용자 간 토큰 세션이 섞이지 않게 매번 새로 만듭니다.
 */
export function getMemberAuth(): Promise<MemberAuthClientWithSignup> {
  if (typeof window === 'undefined') return loadMemberAuth();
  memberAuthPromise ??= loadMemberAuth().catch((loadError: unknown) => {
    memberAuthPromise = null;
    throw loadError;
  });
  return memberAuthPromise;
}

export function getUnifiedAuth(): Promise<UnifiedAuthClient> {
  unifiedAuthPromise ??= (async () => {
    const apiConfig = getWebApiConfig();
    if (process.env.NEXT_PUBLIC_API_MODE !== 'real' && apiConfig.mode === 'mock') {
      const { createMockUnifiedAuth } = await import('@eum/api/unified-auth');
      return createMockUnifiedAuth(apiConfig, getBrowserStore());
    }
    return createRealUnifiedAuth(apiConfig);
  })().catch((loadError: unknown) => {
    unifiedAuthPromise = null;
    throw loadError;
  });
  return unifiedAuthPromise;
}
