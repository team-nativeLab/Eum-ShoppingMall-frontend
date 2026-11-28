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
import { createApiClient } from './http-client';
import type { AdminUser, BuyerSessionMember, Member } from './types';

export const HOME_SERVICE_BENEFITS_STORAGE_KEY = 'eum.mock.home.service-benefits.v1';

/** localStorage와 같은 모양의 최소 저장소 인터페이스(목 데이터 저장용) */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** 저장소 키 열거를 지원하는 구현에서만 제공합니다. */
  keys?(): string[];
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
    keys: () => [...entries.keys()],
  };
}

/** 브라우저면 localStorage, 아니면(서버 렌더링 등) 메모리 저장소를 돌려주는 함수 */
export function getBrowserStore(): KeyValueStore {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const localStorage = window.localStorage;
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
      keys: () => {
        const keys: string[] = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key !== null) keys.push(key);
        }
        return keys;
      },
    };
  }
  return createMemoryStore();
}

/** 일반 회원 로그인 입력 */
export interface MemberLoginInput {
  email: string;
  password: string;
}

export interface MemberLoginOptions {
  remember?: boolean;
}

export interface MemberAuthRequestOptions {
  signal?: AbortSignal;
}

/** 회원가입 입력은 호출 중에만 전달하며 목 인증도 비밀번호를 보관하지 않습니다. */
export interface MemberSignupInput extends MemberLoginInput {
  name: string;
  phone: string;
  accountType: 'personal';
}

/** 목 가입 결과에만 회원 유형을 되돌려 보여 주는 좁은 결과 타입입니다. */
export type MemberSignupResult = Member & {
  accountType: MemberSignupInput['accountType'];
};

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

export interface MemberAuthClient extends AuthClient<BuyerSessionMember, MemberLoginInput> {
  login(input: MemberLoginInput, options?: MemberLoginOptions): Promise<BuyerSessionMember>;
  getCurrentUser(options?: MemberAuthRequestOptions): Promise<BuyerSessionMember | null>;
}
export type AdminAuthClient = AuthClient<AdminUser, AdminLoginInput>;

/** 이메일 중복 확인과 회원가입을 포함한 일반 회원 인증 클라이언트. */
export interface MemberAuthClientWithSignup extends MemberAuthClient {
  isEmailAvailable(email: string): Promise<boolean>;
  signup(input: MemberSignupInput): Promise<MemberSignupResult>;
}

// 아직 연결되지 않은 인증 엔드포인트를 부르면 바로 실패시키는 함수
function notImplemented(endpointName: string): () => Promise<never> {
  return () =>
    Promise.reject(
      new ApiError('NOT_IMPLEMENTED', `실제 인증 API(${endpointName})는 아직 연결되지 않았습니다.`),
    );
}

const MEMBER_REFRESH_PREFERENCE_KEY = 'eum.member-auth.refresh-preference.v1';
const MEMBER_REFRESH_PERSISTENT = 'remember';
const MEMBER_REFRESH_SESSION = 'session';

interface MemberAccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      error.serverCode === 'TOKEN_EXPIRED' ||
      error.serverCode === 'UNAUTHORIZED')
  );
}

function readMemberAccessTokenResponse(response: unknown): MemberAccessTokenResponse {
  if (
    !isRecord(response) ||
    typeof response.accessToken !== 'string' ||
    response.accessToken.trim() === '' ||
    response.accessToken.trim() !== response.accessToken ||
    typeof response.expiresIn !== 'number' ||
    !Number.isFinite(response.expiresIn) ||
    response.expiresIn <= 0
  ) {
    throw new ApiError('INVALID_RESPONSE', '인증 서버 응답 형식이 올바르지 않습니다.');
  }
  return { accessToken: response.accessToken, expiresIn: response.expiresIn };
}

function readMemberId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

function readMemberResponse(response: unknown): BuyerSessionMember {
  const id = isRecord(response) ? readMemberId(response.id) : null;
  if (
    !isRecord(response) ||
    id === null ||
    typeof response.email !== 'string' ||
    typeof response.name !== 'string' ||
    (typeof response.phone !== 'string' && response.phone !== null) ||
    (response.role !== 'USER' && response.role !== null) ||
    typeof response.hasPassword !== 'boolean'
  ) {
    throw new ApiError('INVALID_RESPONSE', '회원 정보 응답 형식이 올바르지 않습니다.');
  }
  return {
    id,
    email: response.email,
    name: response.name,
    phone: response.phone,
  };
}

function waitForPromiseOrAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return promise;
  const getAbortReason = () =>
    signal.reason ?? new DOMException('요청이 취소되었습니다.', 'AbortError');
  if (signal.aborted) return Promise.reject(getAbortReason());
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', handleAbort);
    const handleAbort = () => {
      cleanup();
      reject(getAbortReason());
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
      return;
    }
    promise.then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (failure: unknown) => {
        cleanup();
        reject(failure);
      },
    );
  });
}

function removePersistentRefreshPreference(): void {
  try {
    window.localStorage.removeItem(MEMBER_REFRESH_PREFERENCE_KEY);
  } catch {
    try {
      // 삭제가 막혀도 다음 브라우저 세션에서 이전 remember 값이 되살아나지 않게 덮어씁니다.
      window.localStorage.setItem(MEMBER_REFRESH_PREFERENCE_KEY, MEMBER_REFRESH_SESSION);
    } catch {
      // localStorage 읽기·쓰기와 삭제가 모두 막히면 현재 클라이언트의 memory/session 표식만 적용됩니다.
    }
  }
}

function readRefreshPreference(): 'remember' | 'session' | 'none' {
  if (typeof window === 'undefined') return 'none';
  try {
    if (window.sessionStorage.getItem(MEMBER_REFRESH_PREFERENCE_KEY) === MEMBER_REFRESH_SESSION)
      return 'session';
  } catch {
    // 한 저장소를 읽지 못해도 다른 저장소의 설정은 확인합니다.
  }
  try {
    if (window.localStorage.getItem(MEMBER_REFRESH_PREFERENCE_KEY) === MEMBER_REFRESH_PERSISTENT)
      return 'remember';
  } catch {
    // localStorage 접근이 막혀도 sessionStorage 확인 결과는 유지합니다.
  }
  return 'none';
}

function writeRefreshPreference(remember: boolean): 'remember' | 'session' {
  const preference = remember ? 'remember' : 'session';
  if (typeof window !== 'undefined') {
    if (remember) {
      try {
        window.localStorage.setItem(MEMBER_REFRESH_PREFERENCE_KEY, MEMBER_REFRESH_PERSISTENT);
      } catch {
        // 이 값은 재방문 편의를 위한 설정이며, 서버 인증의 근거로 사용하지 않습니다.
      }
      try {
        window.sessionStorage.removeItem(MEMBER_REFRESH_PREFERENCE_KEY);
      } catch {
        // 남은 session marker는 다음 읽기에서 우선해 현재 세션 범위를 유지합니다.
      }
    } else {
      removePersistentRefreshPreference();
      try {
        window.sessionStorage.setItem(MEMBER_REFRESH_PREFERENCE_KEY, MEMBER_REFRESH_SESSION);
      } catch {
        // 이 값은 재방문 편의를 위한 설정이며, 서버 인증의 근거로 사용하지 않습니다.
      }
    }
  }
  return preference;
}

function clearRefreshPreference(): void {
  if (typeof window === 'undefined') return;
  removePersistentRefreshPreference();
  try {
    window.sessionStorage.removeItem(MEMBER_REFRESH_PREFERENCE_KEY);
  } catch {
    // 저장소 오류와 관계없이 메모리 선호도는 호출부에서 지웁니다.
  }
}

/** real 모드 회원 인증은 access token을 이 클라이언트 인스턴스 메모리에만 둡니다. */
export function createRealMemberAuth(config: ApiConfig): MemberAuthClientWithSignup {
  const client = createApiClient(config.baseUrl);
  let accessToken: string | null = null;
  let refreshPreference = readRefreshPreference();
  let refreshRequest: { revision: number; promise: Promise<string | null> } | null = null;
  let sessionRevision = 0;
  let cookieMutationQueue: Promise<void> = Promise.resolve();

  const serializeCookieMutation = <T>(operation: () => Promise<T>): Promise<T> => {
    const pendingMutation = cookieMutationQueue.then(async () => {
      const lockManager = globalThis.navigator?.locks;
      if (lockManager === undefined) return operation();
      return lockManager.request(
        'eum.member-auth.cookie-mutation',
        { mode: 'exclusive' },
        operation,
      );
    });
    cookieMutationQueue = pendingMutation.then(
      () => undefined,
      () => undefined,
    );
    return pendingMutation;
  };

  const requestMember = async (
    token: string,
    signal?: AbortSignal,
  ): Promise<BuyerSessionMember> => {
    const response = await client.request('/api/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit',
      signal,
      requireEnvelope: true,
    });
    return readMemberResponse(response);
  };

  const refreshAccessToken = async (signal?: AbortSignal): Promise<string | null> => {
    if (refreshPreference === 'none') return null;
    const requestRevision = sessionRevision;
    let currentRefresh = refreshRequest?.revision === requestRevision ? refreshRequest : null;
    if (currentRefresh === null) {
      const pendingRefresh = (async () => {
        try {
          const response = await serializeCookieMutation(() =>
            client.request('/api/v1/auth/refresh', {
              method: 'POST',
              credentials: 'include',
              requireEnvelope: true,
            }),
          );
          const tokenResponse = readMemberAccessTokenResponse(response);
          if (requestRevision !== sessionRevision) return null;
          accessToken = tokenResponse.accessToken;
          return tokenResponse.accessToken;
        } catch (refreshFailure: unknown) {
          if (requestRevision === sessionRevision) {
            accessToken = null;
            if (isUnauthorized(refreshFailure)) {
              refreshPreference = 'none';
              clearRefreshPreference();
            }
          }
          if (isUnauthorized(refreshFailure)) return null;
          throw refreshFailure;
        }
      })();

      const newRefresh = { revision: requestRevision, promise: pendingRefresh };
      refreshRequest = newRefresh;
      void pendingRefresh.then(
        () => {
          if (refreshRequest === newRefresh) refreshRequest = null;
        },
        () => {
          if (refreshRequest === newRefresh) refreshRequest = null;
        },
      );
      currentRefresh = newRefresh;
    }
    // refresh는 회전 cookie 변경을 끝까지 처리하고, 취소는 이 호출자의 대기만 중단합니다.
    return await waitForPromiseOrAbort(currentRefresh.promise, signal);
  };

  const getCurrentUser = async (
    options?: MemberAuthRequestOptions,
  ): Promise<BuyerSessionMember | null> => {
    const requestRevision = sessionRevision;
    let token = accessToken;
    if (token === null) {
      token = await refreshAccessToken(options?.signal);
      if (requestRevision !== sessionRevision) return null;
      if (token === null) return null;
    }

    try {
      const member = await requestMember(token, options?.signal);
      return requestRevision === sessionRevision && token === accessToken ? member : null;
    } catch (memberFailure: unknown) {
      if (requestRevision !== sessionRevision) return null;
      if (!isUnauthorized(memberFailure)) throw memberFailure;
      let refreshedToken: string | null;
      if (token !== accessToken) {
        refreshedToken =
          refreshRequest?.revision === requestRevision
            ? await waitForPromiseOrAbort(refreshRequest.promise, options?.signal)
            : accessToken;
      } else {
        accessToken = null;
        refreshedToken = await refreshAccessToken(options?.signal);
      }
      if (requestRevision !== sessionRevision) return null;
      if (refreshedToken === null) return null;
      try {
        const member = await requestMember(refreshedToken, options?.signal);
        return requestRevision === sessionRevision && refreshedToken === accessToken
          ? member
          : null;
      } catch (retryFailure: unknown) {
        if (
          requestRevision === sessionRevision &&
          refreshedToken === accessToken &&
          isUnauthorized(retryFailure)
        ) {
          accessToken = null;
        }
        throw retryFailure;
      }
    }
  };

  return {
    login(input, options = {}) {
      sessionRevision += 1;
      const loginRevision = sessionRevision;
      return (async () => {
        const response = await serializeCookieMutation(() =>
          client.request('/api/v1/auth/login', {
            method: 'POST',
            json: { email: input.email, password: input.password },
            credentials: 'include',
            requireEnvelope: true,
          }),
        );
        const tokenResponse = readMemberAccessTokenResponse(response);
        if (loginRevision !== sessionRevision) {
          throw new ApiError(
            'INVALID_RESPONSE',
            '로그인 세션이 변경되어 응답을 사용할 수 없습니다.',
          );
        }
        accessToken = tokenResponse.accessToken;
        refreshPreference = writeRefreshPreference(options.remember === true);
        try {
          const member = await getCurrentUser();
          if (loginRevision !== sessionRevision) {
            throw new ApiError(
              'INVALID_RESPONSE',
              '로그인 세션이 변경되어 응답을 사용할 수 없습니다.',
            );
          }
          if (member === null) {
            throw new ApiError('INVALID_RESPONSE', '로그인한 회원 정보를 확인할 수 없습니다.');
          }
          return member;
        } catch (loginFailure: unknown) {
          if (loginRevision === sessionRevision) {
            accessToken = null;
            refreshPreference = 'none';
            clearRefreshPreference();
          }
          throw loginFailure;
        }
      })();
    },
    logout() {
      return (async () => {
        sessionRevision += 1;
        accessToken = null;
        refreshPreference = 'none';
        clearRefreshPreference();
        try {
          await serializeCookieMutation(() =>
            client.request('/api/v1/auth/logout', {
              method: 'POST',
              credentials: 'include',
            }),
          );
        } finally {
          accessToken = null;
          refreshPreference = 'none';
          clearRefreshPreference();
        }
      })();
    },
    getCurrentUser,
    isEmailAvailable: notImplemented('member.isEmailAvailable'),
    signup: notImplemented('member.signup'),
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
