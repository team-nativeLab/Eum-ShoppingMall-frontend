import { describe, expect, it } from 'vitest';
import {
  ApiConfigError,
  assertBuildApiEnv,
  assertMockAllowed,
  resolveApiConfig,
  type RawApiEnv,
} from './config';
import { buildMockConfig } from './test-fixtures';

const baseEnv: RawApiEnv = {
  mode: undefined,
  baseUrl: undefined,
  mockScenario: undefined,
  allowMockInProduction: undefined,
  isProduction: false,
};

describe('resolveApiConfig', () => {
  it('개발에서 mode가 비어 있으면 mock입니다', () => {
    expect(resolveApiConfig(baseEnv).mode).toBe('mock');
  });

  it('운영에서 mode가 비어 있으면 real로 보고 baseUrl을 요구합니다', () => {
    expect(() => resolveApiConfig({ ...baseEnv, isProduction: true })).toThrow(ApiConfigError);
  });

  it('알 수 없는 mode·시나리오는 오류입니다', () => {
    expect(() => resolveApiConfig({ ...baseEnv, mode: 'mok' })).toThrow(ApiConfigError);
    expect(() => resolveApiConfig({ ...baseEnv, mockScenario: 'slow' })).toThrow(ApiConfigError);
  });

  it('운영에서 mock은 명시적 동의가 있어야 합니다', () => {
    const productionMockEnv = { ...baseEnv, mode: 'mock', isProduction: true };
    expect(() => resolveApiConfig(productionMockEnv)).toThrow(ApiConfigError);
    const allowedConfig = resolveApiConfig({ ...productionMockEnv, allowMockInProduction: 'true' });
    expect(allowedConfig).toMatchObject({ mode: 'mock', isMockAllowedInProduction: true });
  });

  it('real 모드는 공백이 아닌 baseUrl이 필요합니다', () => {
    expect(() => resolveApiConfig({ ...baseEnv, mode: 'real' })).toThrow(ApiConfigError);
    expect(() => resolveApiConfig({ ...baseEnv, mode: 'real', baseUrl: '   ' })).toThrow(
      ApiConfigError,
    );
    expect(
      resolveApiConfig({ ...baseEnv, mode: 'real', baseUrl: ' https://api.example.com ' }).baseUrl,
    ).toBe('https://api.example.com');
  });

  it('real 모드에서는 목 시나리오 값을 검사하지 않습니다', () => {
    const realConfig = resolveApiConfig({
      ...baseEnv,
      mode: 'real',
      baseUrl: 'https://api.example.com',
      mockScenario: 'anything',
    });
    expect(realConfig.mockScenario).toBe('normal');
  });
});

describe('assertMockAllowed', () => {
  it('개발 mock은 통과, 운영 mock(동의 없음)과 real은 거부합니다', () => {
    expect(() => assertMockAllowed(buildMockConfig())).not.toThrow();
    expect(() => assertMockAllowed(buildMockConfig({ isProduction: true }))).toThrow(
      ApiConfigError,
    );
    expect(() => assertMockAllowed(buildMockConfig({ mode: 'real' }))).toThrow(ApiConfigError);
  });
});

describe('assertBuildApiEnv', () => {
  it('운영 빌드에서 모드를 비우면 거부합니다', () => {
    expect(() => assertBuildApiEnv({ ...baseEnv, isProduction: true })).toThrow(ApiConfigError);
    expect(() => assertBuildApiEnv({ ...baseEnv, mode: ' ', isProduction: true })).toThrow(
      ApiConfigError,
    );
  });

  it('모드를 명시하면 런타임 규칙대로 검사합니다', () => {
    expect(
      assertBuildApiEnv({
        ...baseEnv,
        mode: 'real',
        baseUrl: 'https://api.example.com',
        isProduction: true,
      }).mode,
    ).toBe('real');
    expect(() => assertBuildApiEnv({ ...baseEnv, mode: 'mock', isProduction: true })).toThrow(
      ApiConfigError,
    );
  });
});
