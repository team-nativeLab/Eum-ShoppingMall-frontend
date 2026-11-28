import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore, createRealAdminAuth, createRealMemberAuth } from './auth';
import { ApiConfigError, ApiError } from './errors';
import {
  ADMIN_SESSION_KEY,
  createAdminMockAuth,
  createMemberMockAuth,
  MEMBER_SESSION_KEY,
} from './mock-auth';
import { mockAdminUsers, mockMembers } from './mock/members';
import { buildMockConfig } from './test-fixtures';
import { createMockUnifiedAuth } from './unified-auth';

const sampleMember = mockMembers[0]!;
const sampleAdmin = mockAdminUsers[0]!;
const mockConfig = buildMockConfig();
let signupTestSequence = 0;

describe('일반 회원 목 인증', () => {
  it('테스트 계정은 중복 가입할 수 없고 로그인 후 userId만 복원합니다', async () => {
    const testMember = mockMembers.find((member) => member.id === 'mem-003');
    if (!testMember) {
      throw new Error('테스트 회원 fixture mem-003이 없습니다.');
    }

    const fixtureEmail = testMember.email;
    const sessionStore = createMemoryStore();
    const memberAuth = createMemberMockAuth(mockConfig, sessionStore);

    expect(await memberAuth.isEmailAvailable(fixtureEmail)).toBe(false);
    await expect(
      memberAuth.signup({
        email: fixtureEmail,
        password: 'non-empty-placeholder',
        name: '테스트 가입자',
        phone: '010-9999-0003',
        accountType: 'personal',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const loggedInMember = await memberAuth.login({
      email: fixtureEmail,
      password: 'non-empty-placeholder',
    });

    expect(loggedInMember.id).toBe(testMember.id);
    expect((await memberAuth.getCurrentUser())?.id).toBe(testMember.id);
    expect(JSON.parse(sessionStore.getItem(MEMBER_SESSION_KEY) ?? '')).toEqual({
      version: 1,
      userId: testMember.id,
    });
  });

  it('로그인하면 현재 회원을 돌려주고, 로그아웃하면 null입니다', async () => {
    const memberAuth = createMemberMockAuth(mockConfig, createMemoryStore());
    const loggedInMember = await memberAuth.login({
      email: sampleMember.email,
      password: 'any-password',
    });
    expect(loggedInMember.id).toBe(sampleMember.id);
    expect((await memberAuth.getCurrentUser())?.id).toBe(sampleMember.id);
    await memberAuth.logout();
    expect(await memberAuth.getCurrentUser()).toBeNull();
  });

  it('저장소에는 userId만 두고 비밀번호·토큰은 저장하지 않습니다', async () => {
    const sessionStore = createMemoryStore();
    await createMemberMockAuth(mockConfig, sessionStore).login({
      email: sampleMember.email,
      password: 'secret-value',
    });
    const rawSession = sessionStore.getItem(MEMBER_SESSION_KEY) ?? '';
    expect(JSON.parse(rawSession)).toEqual({ version: 1, userId: sampleMember.id });
    expect(rawSession).not.toContain('secret-value');
  });

  it('없는 계정은 INVALID_CREDENTIALS, 빈 입력은 VALIDATION 오류입니다', async () => {
    const memberAuth = createMemberMockAuth(mockConfig, createMemoryStore());
    await expect(
      memberAuth.login({ email: 'nobody@example.com', password: 'x' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      memberAuth.login({ email: sampleMember.email, password: ' ' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('깨진 세션 값은 지우고 비로그인으로 취급합니다', async () => {
    const sessionStore = createMemoryStore();
    sessionStore.setItem(MEMBER_SESSION_KEY, '{not-json');
    expect(await createMemberMockAuth(mockConfig, sessionStore).getCurrentUser()).toBeNull();
    expect(sessionStore.getItem(MEMBER_SESSION_KEY)).toBeNull();
  });

  it('개인 가입은 목 회원을 만들고 저장소에는 mock userId만 남깁니다', async () => {
    const sessionStore = createMemoryStore();
    const memberAuth = createMemberMockAuth(mockConfig, sessionStore);
    const email = `signup-${++signupTestSequence}@example.test`;
    const signupMember = await memberAuth.signup({
      email,
      password: 'password-value-123',
      name: '데모 가입자',
      phone: '010-1234-5678',
      accountType: 'personal',
    });

    expect(signupMember.email).toBe(email);
    expect(signupMember.accountType).toBe('personal');
    expect(await memberAuth.isEmailAvailable(email)).toBe(false);
    const currentMember = await memberAuth.getCurrentUser();
    expect(currentMember?.id).toBe(signupMember.id);
    expect(currentMember).toMatchObject({ accountType: 'personal' });
    const rawSession = sessionStore.getItem(MEMBER_SESSION_KEY) ?? '';
    expect(JSON.parse(rawSession)).toEqual({ version: 1, userId: signupMember.id });
    expect(rawSession).not.toContain('password-value-123');
    expect(rawSession).not.toContain(email);
    expect(rawSession).not.toContain('010-1234-5678');
  });

  it('타입을 우회한 사업자 가입 입력은 회원을 만들거나 세션을 저장하지 않습니다', async () => {
    const sessionStore = createMemoryStore();
    const memberAuth = createMemberMockAuth(mockConfig, sessionStore);
    const email = `signup-business-${++signupTestSequence}@example.test`;
    const bypassInput = {
      email,
      password: 'password-value-123',
      name: '사업자 가입 시도',
      phone: '010-1234-5678',
      accountType: 'business',
    } as never;

    await expect(memberAuth.signup(bypassInput)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await memberAuth.isEmailAvailable(email)).toBe(true);
    expect(sessionStore.getItem(MEMBER_SESSION_KEY)).toBeNull();
  });

  it('가입에서 중복 이메일과 빈 비밀번호를 거부합니다', async () => {
    const memberAuth = createMemberMockAuth(mockConfig, createMemoryStore());
    await expect(
      memberAuth.signup({
        email: sampleMember.email,
        password: 'password123',
        name: '중복 가입자',
        phone: '010-1234-5678',
        accountType: 'personal',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      memberAuth.signup({
        email: 'empty-password@example.test',
        password: ' ',
        name: '가입자',
        phone: '010-1234-5678',
        accountType: 'personal',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('목 관리자 이메일은 일반 회원 가입 주소로 예약합니다', async () => {
    const memberAuth = createMemberMockAuth(mockConfig, createMemoryStore());
    const reservedEmail = sampleAdmin.email;
    if (!reservedEmail) throw new Error('관리자 목 계정에 예약 이메일이 필요합니다.');

    expect(await memberAuth.isEmailAvailable(reservedEmail)).toBe(false);
    await expect(
      memberAuth.signup({
        email: ` ${reservedEmail.toUpperCase()} `,
        password: 'password123',
        name: '일반 가입자',
        phone: '010-1234-5678',
        accountType: 'personal',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('관리자 목 인증 — 일반 회원과 분리', () => {
  it('관리자 로그인은 관리자 키에만 저장됩니다', async () => {
    const sharedStore = createMemoryStore();
    await createAdminMockAuth(mockConfig, sharedStore).login({
      loginId: sampleAdmin.loginId,
      password: 'x',
    });
    expect(sharedStore.getItem(ADMIN_SESSION_KEY)).not.toBeNull();
    expect(sharedStore.getItem(MEMBER_SESSION_KEY)).toBeNull();
    expect(await createMemberMockAuth(mockConfig, sharedStore).getCurrentUser()).toBeNull();
  });

  it('일반 회원 이메일로는 관리자 로그인이 되지 않습니다', async () => {
    const adminAuth = createAdminMockAuth(mockConfig, createMemoryStore());
    await expect(
      adminAuth.login({ loginId: sampleMember.email, password: 'x' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('목 통합 로그인 역할 세션 전환', () => {
  it('회원 로그인에 성공하면 Admin 세션을 제거합니다', async () => {
    const store = createMemoryStore();
    await createAdminMockAuth(mockConfig, store).login({
      loginId: sampleAdmin.loginId,
      password: 'x',
    });

    const unifiedAuth = await createMockUnifiedAuth(mockConfig, store);
    const loginResult = await unifiedAuth.login({ email: sampleMember.email, password: 'x' });

    expect(loginResult.role).toBe('member');
    expect(store.getItem(ADMIN_SESSION_KEY)).toBeNull();
    expect(store.getItem(MEMBER_SESSION_KEY)).not.toBeNull();
  });

  it('Admin 로그인에 성공하면 회원 세션을 제거합니다', async () => {
    const store = createMemoryStore();
    await createMemberMockAuth(mockConfig, store).login({
      email: sampleMember.email,
      password: 'x',
    });
    const adminEmail = sampleAdmin.email;
    if (!adminEmail) throw new Error('관리자 목 계정에 이메일이 필요합니다.');

    const unifiedAuth = await createMockUnifiedAuth(mockConfig, store);
    const loginResult = await unifiedAuth.login({ email: adminEmail, password: 'x' });

    expect(loginResult.role).toBe('admin');
    expect(store.getItem(MEMBER_SESSION_KEY)).toBeNull();
    expect(store.getItem(ADMIN_SESSION_KEY)).not.toBeNull();
  });

  it('로그인이 실패하면 기존 역할 세션을 보존합니다', async () => {
    const store = createMemoryStore();
    await createMemberMockAuth(mockConfig, store).login({
      email: sampleMember.email,
      password: 'x',
    });
    const existingMemberSession = store.getItem(MEMBER_SESSION_KEY);
    store.setItem(ADMIN_SESSION_KEY, JSON.stringify({ version: 1, userId: sampleAdmin.id }));
    const existingAdminSession = store.getItem(ADMIN_SESSION_KEY);
    const unifiedAuth = await createMockUnifiedAuth(mockConfig, store);

    await expect(
      unifiedAuth.login({ email: 'unknown@example.test', password: 'x' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(store.getItem(MEMBER_SESSION_KEY)).toBe(existingMemberSession);
    expect(store.getItem(ADMIN_SESSION_KEY)).toBe(existingAdminSession);
  });
});

describe('목 인증과 모드 연결', () => {
  it('운영에서 허용 플래그 없이 목 인증을 만들면 거부합니다', () => {
    const productionConfig = buildMockConfig({ isProduction: true });
    expect(() => createMemberMockAuth(productionConfig, createMemoryStore())).toThrow(
      ApiConfigError,
    );
    expect(() => createAdminMockAuth(productionConfig, createMemoryStore())).toThrow(
      ApiConfigError,
    );
  });

  it('운영이라도 허용 플래그가 있으면 만들 수 있습니다', () => {
    const allowedConfig = buildMockConfig({ isProduction: true, isMockAllowedInProduction: true });
    expect(() => createMemberMockAuth(allowedConfig, createMemoryStore())).not.toThrow();
  });

  it('real 모드 설정으로는 목 인증을 만들 수 없습니다', () => {
    const realConfig = buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.com' });
    expect(() => createAdminMockAuth(realConfig, createMemoryStore())).toThrow(ApiConfigError);
  });

  it('real 회원 인증은 Web API를 사용하고 관리자 인증은 아직 연결되지 않았습니다', async () => {
    const realConfig = buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.com' });
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ email: 'a@example.com', password: 'x' });
        return new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'member-access-token', expiresIn: 900 },
          }),
        );
      }
      if (url.endsWith('/api/v1/me')) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer member-access-token');
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'member-1',
              email: 'a@example.com',
              name: '테스트 회원',
              phone: null,
              role: 'USER',
              hasPassword: true,
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(
        createRealMemberAuth(realConfig).login({ email: 'a@example.com', password: 'x' }),
      ).resolves.toEqual({
        id: 'member-1',
        email: 'a@example.com',
        name: '테스트 회원',
        phone: null,
      });
    } finally {
      vi.unstubAllGlobals();
    }
    await expect(createRealAdminAuth(realConfig).getCurrentUser()).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});
