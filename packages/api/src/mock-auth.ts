/**
 * 목 인증(개발·검증용 스텁). 앱은 mock 모드일 때만 이 모듈을 동적 import합니다.
 *
 * 주의: 이 모듈은 실제 인증이 아닙니다.
 * - 비밀번호를 검증하거나 저장하지 않습니다. 빈 값만 거절하고, 계정 존재 여부만 목 데이터로 확인합니다.
 * - 토큰을 만들거나 저장하지 않습니다. 저장소에는 "어떤 목 계정으로 로그인했는지"(userId)만 둡니다.
 * - 실제 연동 시에는 HttpOnly 쿠키 세션 기반 real 인증(auth.ts)으로 교체합니다.
 *   localStorage에 토큰을 두는 방식으로 확장하지 않습니다.
 * - 화면의 로그인 확인은 UX일 뿐이고 실제 인가는 서버가 합니다.
 * - 운영 빌드에서 ALLOW_MOCK_IN_PRODUCTION 없이 만들면 ApiConfigError로 거부합니다.
 */
import type { AdminAuthClient, KeyValueStore, MemberAuthClient } from './auth';
import { assertMockAllowed, type ApiConfig } from './config';
import { ApiError } from './errors';
import { mockAdminUsers, mockMembers } from './mock/members';

const SESSION_SCHEMA_VERSION = 1;
export const MEMBER_SESSION_KEY = 'eum.mock-session.member.v1';
export const ADMIN_SESSION_KEY = 'eum.mock-session.admin.v1';

interface StoredMockSession {
  version: typeof SESSION_SCHEMA_VERSION;
  userId: string;
}

// 저장된 세션을 읽는 함수. 형식이 다르거나 깨져 있으면 지우고 null을 돌려줍니다.
function readSession(store: KeyValueStore, sessionKey: string): StoredMockSession | null {
  const rawSession = store.getItem(sessionKey);
  if (rawSession === null) return null;
  try {
    const parsedSession: unknown = JSON.parse(rawSession);
    if (
      typeof parsedSession === 'object' &&
      parsedSession !== null &&
      'version' in parsedSession &&
      parsedSession.version === SESSION_SCHEMA_VERSION &&
      'userId' in parsedSession &&
      typeof parsedSession.userId === 'string'
    ) {
      return { version: SESSION_SCHEMA_VERSION, userId: parsedSession.userId };
    }
  } catch {
    // 깨진 값은 아래에서 지웁니다.
  }
  store.removeItem(sessionKey);
  return null;
}

// 세션(userId만)을 저장하는 함수
function writeSession(store: KeyValueStore, sessionKey: string, userId: string): void {
  const session: StoredMockSession = { version: SESSION_SCHEMA_VERSION, userId };
  store.setItem(sessionKey, JSON.stringify(session));
}

// 빈 입력을 거절하는 공통 검사
function assertFilled(fieldValues: string[]): void {
  if (fieldValues.some((fieldValue) => fieldValue.trim() === '')) {
    throw new ApiError('VALIDATION', '아이디와 비밀번호를 입력해 주십시오.');
  }
}

/** 일반 회원용 목 인증을 만드는 함수 */
export function createMemberMockAuth(config: ApiConfig, store: KeyValueStore): MemberAuthClient {
  assertMockAllowed(config);
  return {
    async login({ email, password }) {
      assertFilled([email, password]);
      const normalizedEmail = email.trim().toLowerCase();
      const member = mockMembers.find(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail,
      );
      if (!member) {
        throw new ApiError('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
      }
      writeSession(store, MEMBER_SESSION_KEY, member.id);
      return structuredClone(member);
    },
    async logout() {
      store.removeItem(MEMBER_SESSION_KEY);
    },
    async getCurrentUser() {
      const session = readSession(store, MEMBER_SESSION_KEY);
      if (!session) return null;
      const member = mockMembers.find((candidate) => candidate.id === session.userId);
      return member ? structuredClone(member) : null;
    },
  };
}

/** 관리자용 목 인증을 만드는 함수. 일반 회원 계정으로는 로그인할 수 없습니다. */
export function createAdminMockAuth(config: ApiConfig, store: KeyValueStore): AdminAuthClient {
  assertMockAllowed(config);
  return {
    async login({ loginId, password }) {
      assertFilled([loginId, password]);
      const adminUser = mockAdminUsers.find((candidate) => candidate.loginId === loginId.trim());
      if (!adminUser) {
        throw new ApiError('INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.');
      }
      writeSession(store, ADMIN_SESSION_KEY, adminUser.id);
      return structuredClone(adminUser);
    },
    async logout() {
      store.removeItem(ADMIN_SESSION_KEY);
    },
    async getCurrentUser() {
      const session = readSession(store, ADMIN_SESSION_KEY);
      if (!session) return null;
      const adminUser = mockAdminUsers.find((candidate) => candidate.id === session.userId);
      return adminUser ? structuredClone(adminUser) : null;
    },
  };
}
