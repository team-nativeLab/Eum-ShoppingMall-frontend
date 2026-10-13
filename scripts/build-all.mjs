// 루트 `npm run build`(검증용 빌드): web과 admin을 차례로 빌드합니다.
//
// 실제 API가 아직 없으므로, API 모드를 지정하지 않으면 "목 모드 검증 빌드"로 명시해 빌드합니다.
// - 이 기본값은 이 스크립트에서만 적용됩니다. 배포 빌드는 앱별 명령(npm run build -w @eum/web 등)과
//   배포 환경변수를 쓰며, 그때 모드가 없거나 목인데 허용 플래그가 없으면 빌드가 실패합니다
//   (apps/web/next.config.ts, apps/admin/vite.config.ts).
// - 셸이나 CI에서 *_API_MODE를 지정하면(빈 문자열 포함) 그 값을 그대로 넘기고, 검사는 각 앱 빌드 설정이 합니다.
// - CI(CI=true)에서는 기본값을 넣지 않고 실패합니다. CI는 워크플로 env에 모드를 명시해야 합니다.
// 크로스 플랫폼(Windows 포함)으로 환경변수를 넘기려고 셸 문법 대신 Node 스크립트를 씁니다.
import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// 앱별 환경변수 이름 묶음
const APP_TARGETS = [
  {
    workspace: '@eum/web',
    modeEnv: 'NEXT_PUBLIC_API_MODE',
    allowEnv: 'NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION',
  },
  { workspace: '@eum/admin', modeEnv: 'VITE_API_MODE', allowEnv: 'VITE_ALLOW_MOCK_IN_PRODUCTION' },
];

for (const appTarget of APP_TARGETS) {
  const buildEnv = { ...process.env };
  if (buildEnv[appTarget.modeEnv] === undefined) {
    if (process.env.CI === 'true') {
      console.error(
        `[build-all] ${appTarget.workspace}: CI에서는 ${appTarget.modeEnv}를 워크플로 env에 명시해야 합니다.`,
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
}
