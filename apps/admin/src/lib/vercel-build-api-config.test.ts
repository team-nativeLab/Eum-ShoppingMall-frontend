import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from 'vite';

const environmentVariableNames = [
  'NODE_ENV',
  'VERCEL',
  'VERCEL_ENV',
  'VITE_API_MODE',
  'VITE_API_BASE_URL',
  'VITE_ALLOW_MOCK_IN_PRODUCTION',
] as const;

type BuildEnvironment = Partial<Record<(typeof environmentVariableNames)[number], string>>;

async function resolveAdminBuildConfig(environment: BuildEnvironment) {
  for (const environmentVariableName of environmentVariableNames) {
    vi.stubEnv(environmentVariableName, environment[environmentVariableName]);
  }

  return resolveConfig(
    { configFile: 'apps/admin/vite.config.ts', root: 'apps/admin', mode: 'production' },
    'build',
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Admin Vercel build API configuration', () => {
  it('allows mock mode in Vercel Preview for the protected test deployment', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
        VITE_ALLOW_MOCK_IN_PRODUCTION: 'true',
      }),
    ).resolves.toBeDefined();
  });

  it('allows mock mode in Vercel Production with the explicit opt-in flag', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
        VITE_ALLOW_MOCK_IN_PRODUCTION: 'true',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects Vercel Production mock mode when the opt-in flag is missing', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
      }),
    ).rejects.toThrow('ALLOW_MOCK_IN_PRODUCTION=true');
  });

  it('requires the Production opt-in independently of NODE_ENV', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'test',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
      }),
    ).rejects.toThrow('ALLOW_MOCK_IN_PRODUCTION=true');
  });

  it('rejects mock mode when Vercel does not identify the deployment environment', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
        VITE_ALLOW_MOCK_IN_PRODUCTION: 'true',
      }),
    ).rejects.toThrow('VERCEL_ENV=preview 또는 production 식별이 필요합니다.');
  });

  it('rejects a Production real mode that still uses the reserved placeholder host', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_API_MODE: 'real',
        VITE_API_BASE_URL: 'https://api-admin-preview.invalid',
      }),
    ).rejects.toThrow('실제 VITE_API_BASE_URL이 필요합니다.');
  });

  it('rejects an HTTP real API address in Vercel Production', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_API_MODE: 'real',
        VITE_API_BASE_URL: 'http://api.example.com',
      }),
    ).rejects.toThrow('VITE_API_BASE_URL은 https 주소여야 합니다.');
  });

  it('keeps the real API scaffold available for Vercel Preview', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        VITE_API_MODE: 'real',
      }),
    ).resolves.toBeDefined();
  });

  it('keeps local mock builds available without Vercel environment variables', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
        VITE_ALLOW_MOCK_IN_PRODUCTION: 'true',
      }),
    ).resolves.toBeDefined();
  });
});
