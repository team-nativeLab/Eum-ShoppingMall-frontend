export const APP_TARGETS = [
  { workspace: '@eum/admin', modeEnv: 'VITE_API_MODE', allowEnv: 'VITE_ALLOW_MOCK_IN_PRODUCTION' },
  {
    workspace: '@eum/web',
    modeEnv: 'NEXT_PUBLIC_API_MODE',
    allowEnv: 'NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION',
  },
];

export function resolveBuildEnvironment(appTarget, sourceEnv) {
  const buildEnv = { ...sourceEnv };
  const isVercelPreview = sourceEnv.VERCEL_ENV === 'preview';
  const isVercelProduction = sourceEnv.VERCEL_ENV === 'production';
  const isVercelBuild = sourceEnv.VERCEL !== undefined || sourceEnv.VERCEL_ENV !== undefined;
  const apiMode = buildEnv[appTarget.modeEnv];

  if (isVercelBuild && !isVercelPreview && !isVercelProduction) {
    return {
      error: 'Vercel 빌드는 VERCEL_ENV=preview 또는 production 식별이 필요합니다.',
    };
  }

  if (isVercelProduction) {
    if (apiMode === 'real') return { env: buildEnv };
    if (apiMode === 'mock' && buildEnv[appTarget.allowEnv] === 'true') {
      return { env: buildEnv };
    }
    if (apiMode === 'mock') {
      return {
        error: `Vercel Production mock 배포에는 ${appTarget.allowEnv}=true가 필요합니다.`,
      };
    }
    return {
      error: `Vercel Production은 ${appTarget.modeEnv}=real 또는 ${appTarget.modeEnv}=mock와 ${appTarget.allowEnv}=true 설정이 필요합니다.`,
    };
  }

  if (apiMode !== undefined) return { env: buildEnv };

  if (isVercelPreview) {
    buildEnv[appTarget.modeEnv] = 'mock';
    buildEnv[appTarget.allowEnv] = 'true';
    return {
      env: buildEnv,
      warning: `Vercel Preview 테스트용 목 모드로 빌드합니다.`,
    };
  }

  if (sourceEnv.CI === 'true' || isVercelBuild) {
    return {
      error: `CI/Vercel에서는 ${appTarget.modeEnv}를 명시해야 합니다.`,
    };
  }

  buildEnv[appTarget.modeEnv] = 'mock';
  buildEnv[appTarget.allowEnv] = 'true';
  return {
    env: buildEnv,
    warning: `${appTarget.modeEnv}가 없어 목 모드 검증 빌드로 진행합니다(배포용 아님).`,
  };
}
