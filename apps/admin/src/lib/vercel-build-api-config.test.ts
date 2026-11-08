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
  it('allows mock mode in Vercel Production only with the explicit flag and no API URL', async () => {
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

  it('requires the explicit mock flag for Vercel Production even when NODE_ENV is not production', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'test',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_API_MODE: 'mock',
      }),
    ).rejects.toThrow('VITE_ALLOW_MOCK_IN_PRODUCTION=true');
  });

  it('rejects mock mode in Vercel Preview even when the explicit flag is set', async () => {
    await expect(
      resolveAdminBuildConfig({
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        VITE_API_MODE: 'mock',
        VITE_API_BASE_URL: '',
        VITE_ALLOW_MOCK_IN_PRODUCTION: 'true',
      }),
    ).rejects.toThrow('Vercel Preview 배포에는 VITE_API_MODE=real이 필요합니다.');
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
    ).rejects.toThrow('Vercel Preview 배포에는 VITE_API_MODE=real이 필요합니다.');
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
