import { describe, expect, it } from 'vitest';
import { APP_TARGETS, resolveBuildEnvironment } from './build-all-config.mjs';

describe.each(APP_TARGETS)('$workspace build environment', (appTarget) => {
  it('allows Production real mode and leaves URL validation to the app config', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      [appTarget.modeEnv]: 'real',
    });

    expect(buildEnvironment.error).toBeUndefined();
    expect(buildEnvironment.env?.[appTarget.modeEnv]).toBe('real');
  });

  it('rejects Production mock mode even when its app-specific opt-in flag is set', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      [appTarget.modeEnv]: 'mock',
      [appTarget.allowEnv]: 'true',
    });

    expect(buildEnvironment.error).toContain(`${appTarget.modeEnv}=real`);
  });

  it('rejects Production mock mode when its app-specific opt-in flag is missing', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      [appTarget.modeEnv]: 'mock',
    });

    expect(buildEnvironment.error).toContain(`${appTarget.modeEnv}=real`);
  });

  it.each([undefined, ''])('rejects Production when mode is %s', (apiMode) => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      [appTarget.modeEnv]: apiMode,
    });

    expect(buildEnvironment.error).toContain(appTarget.modeEnv);
  });

  it('defaults an unset Preview mode to mock with the opt-in flag', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    });

    expect(buildEnvironment.env?.[appTarget.modeEnv]).toBe('mock');
    expect(buildEnvironment.env?.[appTarget.allowEnv]).toBe('true');
  });

  it('preserves an explicit Preview override', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      [appTarget.modeEnv]: 'real',
    });

    expect(buildEnvironment.error).toBeUndefined();
    expect(buildEnvironment.env?.[appTarget.modeEnv]).toBe('real');
    expect(buildEnvironment.env?.[appTarget.allowEnv]).toBeUndefined();
  });

  it('rejects an unset mode in general CI', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, { CI: 'true' });

    expect(buildEnvironment.error).toContain(`CI/Vercel에서는 ${appTarget.modeEnv}`);
  });

  it.each([
    ['missing VERCEL_ENV', { VERCEL: '1' }],
    ['unknown VERCEL_ENV', { VERCEL: '1', VERCEL_ENV: 'development' }],
    ['unknown VERCEL_ENV without VERCEL', { VERCEL_ENV: 'development' }],
  ])('rejects %s with mock mode and opt-in', (_environmentCase, vercelEnvironment) => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      ...vercelEnvironment,
      [appTarget.modeEnv]: 'mock',
    });

    expect(buildEnvironment.error).toContain('VERCEL_ENV=preview 또는 production');
  });

  it.each([
    ['missing VERCEL_ENV', { VERCEL: '1' }],
    ['unknown VERCEL_ENV', { VERCEL: '1', VERCEL_ENV: 'development' }],
    ['unknown VERCEL_ENV without VERCEL', { VERCEL_ENV: 'development' }],
  ])('rejects %s with real mode', (_environmentCase, vercelEnvironment) => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      ...vercelEnvironment,
      [appTarget.modeEnv]: 'real',
    });

    expect(buildEnvironment.error).toContain('VERCEL_ENV=preview 또는 production');
  });

  it('recognizes a valid Vercel Preview from VERCEL_ENV alone', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL_ENV: 'preview',
      [appTarget.modeEnv]: 'real',
    });

    expect(buildEnvironment.error).toBeUndefined();
    expect(buildEnvironment.env?.[appTarget.modeEnv]).toBe('real');
  });

  it('recognizes a valid Vercel Production from VERCEL_ENV alone', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      VERCEL_ENV: 'production',
      [appTarget.modeEnv]: 'mock',
      [appTarget.allowEnv]: 'true',
    });

    expect(buildEnvironment.error).toContain(`${appTarget.modeEnv}=real`);
  });

  it('defaults an unset local mode to a verification-only mock build', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {});

    expect(buildEnvironment.env?.[appTarget.modeEnv]).toBe('mock');
    expect(buildEnvironment.env?.[appTarget.allowEnv]).toBe('true');
  });

  it('preserves an explicitly empty mode for the app build validator to reject', () => {
    const buildEnvironment = resolveBuildEnvironment(appTarget, {
      [appTarget.modeEnv]: '',
    });

    expect(buildEnvironment.error).toBeUndefined();
    expect(buildEnvironment.env?.[appTarget.modeEnv]).toBe('');
  });
});
