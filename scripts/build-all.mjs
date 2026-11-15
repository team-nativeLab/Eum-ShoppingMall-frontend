// 루트 `npm run build`(검증용 빌드): web과 admin을 차례로 빌드합니다.
//
// 실제 API가 아직 없으므로, 로컬 검증과 Vercel Preview에서 목 모드 빌드를 지원합니다.
// - Preview는 테스트용 목 데이터만 사용합니다. 실제 고객 데이터를 넣지 마세요.
// - Vercel Production은 두 앱 모두 real 모드와 실제 API 주소를 요구합니다.
// - 셸이나 CI에서 *_API_MODE를 지정하면(빈 문자열 포함) 그 값을 그대로 넘기고, 검사는 각 앱 빌드 설정이 합니다.
// - 일반 CI(CI=true)에서는 기본값을 넣지 않고 실패합니다. CI는 워크플로 env에 모드를 명시해야 합니다.
// 크로스 플랫폼(Windows 포함)으로 환경변수를 넘기려고 셸 문법 대신 Node 스크립트를 씁니다.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isVercelPreview = process.env.VERCEL_ENV === 'preview';
const isVercelProduction = process.env.VERCEL_ENV === 'production';
const isVercelBuild = process.env.VERCEL !== undefined || process.env.VERCEL_ENV !== undefined;
const allowPreviewMock = isVercelPreview;

// 앱별 환경변수 이름 묶음
const APP_TARGETS = [
  { workspace: '@eum/admin', modeEnv: 'VITE_API_MODE', allowEnv: 'VITE_ALLOW_MOCK_IN_PRODUCTION' },
  {
    workspace: '@eum/web',
    modeEnv: 'NEXT_PUBLIC_API_MODE',
    allowEnv: 'NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION',
  },
];

for (const appTarget of APP_TARGETS) {
  const buildEnv = { ...process.env };
  if (isVercelProduction && buildEnv[appTarget.modeEnv] !== 'real') {
    console.error(
      `[build-all] ${appTarget.workspace}: Vercel Production은 ${appTarget.modeEnv}=real 설정이 필요합니다.`,
    );
    process.exit(1);
  }
  if (buildEnv[appTarget.modeEnv] === undefined) {
    if (allowPreviewMock) {
      buildEnv[appTarget.modeEnv] = 'mock';
      buildEnv[appTarget.allowEnv] = 'true';
      console.warn(
        `[build-all] ${appTarget.workspace}: Vercel Preview 테스트용 목 모드로 빌드합니다.`,
      );
    } else if (process.env.CI === 'true' || isVercelBuild) {
      console.error(
        `[build-all] ${appTarget.workspace}: CI/Vercel에서는 ${appTarget.modeEnv}를 명시해야 합니다.`,
      );
      process.exit(1);
    }
    buildEnv[appTarget.modeEnv] = 'mock';
    buildEnv[appTarget.allowEnv] = 'true';
    console.warn(
      `[build-all] ${appTarget.workspace}: ${appTarget.modeEnv}가 없어 목 모드 검증 빌드로 진행합니다(배포용 아님).`,
    );
  }
  const buildResult = spawnSync(npmCommand, ['run', 'build', '--workspace', appTarget.workspace], {
    stdio: 'inherit',
    env: buildEnv,
  });
  if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);
  if (appTarget.workspace === '@eum/admin') {
    const adminOutput = resolve('apps/admin/dist');
    const webAdminPublicDir = resolve('apps/web/public/admin');
    await rm(webAdminPublicDir, { recursive: true, force: true });
    await mkdir(webAdminPublicDir, { recursive: true });
    await cp(adminOutput, webAdminPublicDir, { recursive: true });
  }
}
