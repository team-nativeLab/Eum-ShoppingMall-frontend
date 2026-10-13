import { createRealMemberAuth, getBrowserStore, type MemberAuthClient } from '@eum/api/auth';
import { getWebApiConfig } from './api-config';

let memberAuthPromise: Promise<MemberAuthClient> | null = null;

// 설정에 맞는 일반 회원 인증 구현을 만드는 함수. real 빌드에서는 목 인증 chunk가 빠집니다.
async function loadMemberAuth(): Promise<MemberAuthClient> {
  const apiConfig = getWebApiConfig();
  if (process.env.NEXT_PUBLIC_API_MODE !== 'real' && apiConfig.mode === 'mock') {
    const { createMemberMockAuth } = await import('@eum/api/mock-auth');
    return createMemberMockAuth(apiConfig, getBrowserStore());
  }
  return createRealMemberAuth(apiConfig);
}

/**
 * 일반 회원 인증 클라이언트를 한 번만 만들어 돌려주는 함수(로그인 화면은 3단계에서 연결).
 * 화면의 로그인 확인은 UX일 뿐이며 실제 인가는 서버(HttpOnly 세션)가 합니다.
 */
export function getMemberAuth(): Promise<MemberAuthClient> {
  memberAuthPromise ??= loadMemberAuth().catch((loadError: unknown) => {
    memberAuthPromise = null;
    throw loadError;
  });
  return memberAuthPromise;
}
