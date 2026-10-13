/**
 * 인증 클라이언트 공통 타입과 real 모드 스텁.
 *
 * 보안 전제:
 * - 화면의 로그인 확인·라우트 가드는 사용자 경험(UX)을 위한 것일 뿐입니다. 실제 인가는 서버가 합니다.
 * - 실제 연동은 HttpOnly 쿠키 세션을 전제로 합니다. 토큰을 localStorage 등 스크립트가 읽는 저장소에 두지 않습니다.
 * - 일반 회원과 관리자는 별개의 인증 클라이언트·세션을 씁니다. 비회원 주문은 없습니다.
 */
import type { ApiConfig } from './config';
import { ApiError } from './errors';
import type { AdminUser, Member } from './types';

/** localStorage와 같은 모양의 최소 저장소 인터페이스(목 세션 보관용) */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 메모리 저장소. SSR·테스트처럼 localStorage가 없을 때 씁니다. */
export function createMemoryStore(): KeyValueStore {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/** 브라우저면 localStorage, 아니면(서버 렌더링 등) 메모리 저장소를 돌려주는 함수 */
export function getBrowserStore(): KeyValueStore {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return createMemoryStore();
}

/** 일반 회원 로그인 입력 */
export interface MemberLoginInput {
  email: string;
  password: string;
}

/** 관리자 로그인 입력 */
export interface AdminLoginInput {
  loginId: string;
  password: string;
}

/** 인증 함수 묶음. mock과 real이 같은 모양을 구현합니다. */
export interface AuthClient<TUser, TLoginInput> {
  login(input: TLoginInput): Promise<TUser>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<TUser | null>;
}

export type MemberAuthClient = AuthClient<Member, MemberLoginInput>;
export type AdminAuthClient = AuthClient<AdminUser, AdminLoginInput>;

// 아직 연결되지 않은 인증 엔드포인트를 부르면 바로 실패시키는 함수
function notImplemented(endpointName: string): () => Promise<never> {
  return () =>
    Promise.reject(
      new ApiError('NOT_IMPLEMENTED', `실제 인증 API(${endpointName})는 아직 연결되지 않았습니다.`),
    );
}

/** real 모드 일반 회원 인증 스텁. 서버 스펙이 정해지면 HttpOnly 세션 기반으로 채웁니다. */
export function createRealMemberAuth(_config: ApiConfig): MemberAuthClient {
  return {
    login: notImplemented('member.login'),
    logout: notImplemented('member.logout'),
    getCurrentUser: notImplemented('member.getCurrentUser'),
  };
}

/** real 모드 관리자 인증 스텁 */
export function createRealAdminAuth(_config: ApiConfig): AdminAuthClient {
  return {
    login: notImplemented('admin.login'),
    logout: notImplemented('admin.logout'),
    getCurrentUser: notImplemented('admin.getCurrentUser'),
  };
}
