import { describe, expect, it } from 'vitest';
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

const sampleMember = mockMembers[0]!;
const sampleAdmin = mockAdminUsers[0]!;
const mockConfig = buildMockConfig();

describe('일반 회원 목 인증', () => {
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

  it('real 인증 스텁은 NOT_IMPLEMENTED를 던집니다', async () => {
    const realConfig = buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.com' });
    await expect(
      createRealMemberAuth(realConfig).login({ email: 'a@example.com', password: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(createRealAdminAuth(realConfig).getCurrentUser()).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});
