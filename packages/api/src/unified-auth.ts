import type { AdminRole, AdminUser, BuyerSessionMember } from './types';
import type { MemberLoginInput, KeyValueStore } from './auth';
import type { ApiConfig } from './config';
import { ApiError } from './errors';

export type UnifiedLoginResult =
  | { role: 'member'; user: BuyerSessionMember }
  | { role: 'admin'; user: AdminUser & { role: AdminRole } };

export interface UnifiedAuthClient {
  login(input: MemberLoginInput): Promise<UnifiedLoginResult>;
  logout(): Promise<void>;
}

export function createRealUnifiedAuth(_config: ApiConfig): UnifiedAuthClient {
  return {
    login: async () => {
      throw new ApiError('NOT_IMPLEMENTED', '실제 통합 로그인 API는 아직 연결되지 않았습니다.');
    },
    logout: async () => {
      throw new ApiError('NOT_IMPLEMENTED', '실제 통합 로그아웃 API는 아직 연결되지 않았습니다.');
    },
  };
}

/** mock 모드에서 이메일에 등록된 역할을 분기합니다. 실제 권한 판단은 서버가 담당합니다. */
export async function createMockUnifiedAuth(
  config: ApiConfig,
  store: KeyValueStore,
): Promise<UnifiedAuthClient> {
  const { ADMIN_SESSION_KEY, MEMBER_SESSION_KEY, createAdminMockAuth, createMemberMockAuth } =
    await import('./mock-auth');
  const { mockAdminUsers } = await import('./mock/members');
  const adminAuth = createAdminMockAuth(config, store);
  const memberAuth = createMemberMockAuth(config, store);
  return {
    async login(input) {
      const matchingAdmin = mockAdminUsers.find(
        (admin) => admin.email?.toLowerCase() === input.email.trim().toLowerCase(),
      );
      if (matchingAdmin) {
        const user = await adminAuth.login({
          loginId: matchingAdmin.loginId,
          password: input.password,
        });
        store.removeItem(MEMBER_SESSION_KEY);
        return { role: 'admin', user };
      }
      const user = await memberAuth.login(input);
      store.removeItem(ADMIN_SESSION_KEY);
      return { role: 'member', user };
    },
    async logout() {
      await Promise.all([adminAuth.logout(), memberAuth.logout()]);
    },
  };
}
