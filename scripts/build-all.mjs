// 루트 `npm run build`(검증용 빌드): web과 admin을 차례로 빌드합니다.
//
// 실제 API가 아직 없으므로 로컬·Vercel Preview 및 opt-in한 테스트 Production에서 목 빌드를 지원합니다.
// - Preview는 테스트용 목 데이터만 사용합니다. 실제 고객 데이터를 넣지 마세요.
// - Production mock은 각 앱의 opt-in 환경변수를 정확히 true로 설정해야 합니다.
//   모드와 API 주소 검증은 각 앱 빌드 설정이 합니다.
// - 셸이나 CI에서 *_API_MODE를 지정하면(빈 문자열 포함) 그 값을 그대로 넘깁니다.
// - 일반 CI(CI=true)에서는 기본값을 넣지 않고 실패합니다. CI는 워크플로 env에 모드를 명시해야 합니다.
// 크로스 플랫폼(Windows 포함)으로 환경변수를 넘기려고 셸 문법 대신 Node 스크립트를 씁니다.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { APP_TARGETS, resolveBuildEnvironment } from './build-all-config.mjs';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const appTarget of APP_TARGETS) {
  const resolvedEnvironment = resolveBuildEnvironment(appTarget, process.env);
  if (resolvedEnvironment.error) {
    console.error(`[build-all] ${appTarget.workspace}: ${resolvedEnvironment.error}`);
    process.exit(1);
  }

  const buildEnv = resolvedEnvironment.env;
  if (resolvedEnvironment.warning) {
    console.warn(`[build-all] ${appTarget.workspace}: ${resolvedEnvironment.warning}`);
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
