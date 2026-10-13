/**
 * API 레이어 설정과 환경변수 해석.
 * 패키지 안에서는 환경변수를 직접 읽지 않습니다. 각 앱 진입점과 빌드 설정(next.config.ts, vite.config.ts)이
 * 자기 env를 읽어 resolveApiConfig()에 넘깁니다. 빌드 설정에서도 불리므로 이 파일은 다른 모듈을 import하지 않습니다.
 */

/**
 * API 설정(환경변수)이 잘못되었을 때 던지는 오류. 다시 시도해도 해결되지 않습니다.
 * vite.config.ts가 이 파일을 Node로 직접 불러오므로(확장자 없는 상대 import를 풀지 못함) 다른 모듈을 import하지 않고 여기서 정의합니다.
 */
export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

/** mock: 패키지 내장 목 데이터, real: 실제 서버(아직 스텁) */
export type ApiMode = 'mock' | 'real';

/** 목 응답 시나리오. 로딩·에러·빈 상태 화면을 재현할 때 씁니다. */
export type MockScenario = 'normal' | 'empty' | 'error';

/** 목·real API(createMockApi, createRealApi)와 인증 팩토리에 넘기는 설정 */
export interface ApiConfig {
  mode: ApiMode;
  /** real 모드에서 요청할 서버 주소 */
  baseUrl: string;
  /** 목 응답 지연(ms). 테스트에서는 0 */
  mockLatencyMs: number;
  mockScenario: MockScenario;
  isProduction: boolean;
  /** 운영에서 목 모드를 명시적으로 허용했는지 */
  isMockAllowedInProduction: boolean;
}

/** 앱이 읽어 온 원본 환경변수 값 */
export interface RawApiEnv {
  mode: string | undefined;
  baseUrl: string | undefined;
  mockScenario: string | undefined;
  /** 운영 빌드에서 목 모드를 쓰겠다는 명시적 동의("true"일 때만 인정) */
  allowMockInProduction: string | undefined;
  isProduction: boolean;
}

const DEFAULT_MOCK_LATENCY_MS = 300;

// 알 수 없는 문자열이 조용히 mock으로 떨어지지 않도록 허용 값을 명시적으로 검사하는 함수
function parseApiMode(rawMode: string | undefined): ApiMode | undefined {
  if (rawMode === undefined || rawMode === '') return undefined;
  if (rawMode === 'mock' || rawMode === 'real') return rawMode;
  throw new ApiConfigError(
    `API_MODE 값 "${rawMode}"은 지원하지 않습니다. mock 또는 real만 쓸 수 있습니다.`,
  );
}

// 목 시나리오 문자열을 검사하는 함수. 비어 있으면 normal
function parseMockScenario(rawScenario: string | undefined): MockScenario {
  if (rawScenario === undefined || rawScenario === '') return 'normal';
  if (rawScenario === 'normal' || rawScenario === 'empty' || rawScenario === 'error') {
    return rawScenario;
  }
  throw new ApiConfigError(
    `MOCK_SCENARIO 값 "${rawScenario}"은 지원하지 않습니다. normal, empty, error만 쓸 수 있습니다.`,
  );
}

/**
 * 앱 환경변수를 검증해 ApiConfig로 바꾸는 함수.
 * - mode가 비어 있으면 개발에서는 mock, 운영에서는 real로 보고 baseUrl을 요구합니다.
 * - 운영에서 mock은 allowMockInProduction="true"일 때만 허용합니다(실수로 목 데이터가 배포되는 것을 막음).
 * - real 모드는 공백이 아닌 baseUrl이 필요하고, 목 시나리오 값은 검사하지 않습니다.
 */
export function resolveApiConfig(rawEnv: RawApiEnv): ApiConfig {
  const parsedMode = parseApiMode(rawEnv.mode);
  const mode: ApiMode = parsedMode ?? (rawEnv.isProduction ? 'real' : 'mock');
  const isMockAllowedInProduction = rawEnv.allowMockInProduction === 'true';

  if (rawEnv.isProduction && mode === 'mock' && !isMockAllowedInProduction) {
    throw new ApiConfigError(
      '운영 빌드에서 목 API를 쓰려면 ALLOW_MOCK_IN_PRODUCTION=true를 명시해야 합니다.',
    );
  }

  const baseUrl = (rawEnv.baseUrl ?? '').trim();
  if (mode === 'real' && baseUrl === '') {
    throw new ApiConfigError('real 모드에는 API_BASE_URL이 필요합니다.');
  }

  return {
    mode,
    baseUrl,
    mockLatencyMs: DEFAULT_MOCK_LATENCY_MS,
    mockScenario: mode === 'mock' ? parseMockScenario(rawEnv.mockScenario) : 'normal',
    isProduction: rawEnv.isProduction,
    isMockAllowedInProduction,
  };
}

/**
 * 목 구현을 만들어도 되는 설정인지 확인하는 함수. 목 API·목 인증 팩토리가 맨 먼저 부릅니다.
 * resolveApiConfig를 거치지 않고 손으로 만든 설정이 들어와도 운영 목 사용을 막기 위한 이중 확인입니다.
 */
export function assertMockAllowed(config: ApiConfig): void {
  if (config.mode !== 'mock') {
    throw new ApiConfigError('mock 모드가 아닌 설정으로 목 구현을 만들 수 없습니다.');
  }
  if (config.isProduction && !config.isMockAllowedInProduction) {
    throw new ApiConfigError(
      '운영 빌드에서 목 API를 쓰려면 ALLOW_MOCK_IN_PRODUCTION=true를 명시해야 합니다.',
    );
  }
}

/**
 * 운영 빌드 시점 검사 함수(next.config.ts, vite.config.ts에서 호출).
 * 런타임 규칙(resolveApiConfig)에 더해, 운영 빌드는 API 모드를 반드시 명시해야 합니다.
 * 모드를 비운 운영 빌드는 빌드 상수 분기가 목 chunk를 남길 수 있으므로 거부합니다(배포는 *_API_MODE=real 명시).
 */
export function assertBuildApiEnv(rawEnv: RawApiEnv): ApiConfig {
  if (rawEnv.isProduction && (rawEnv.mode === undefined || rawEnv.mode.trim() === '')) {
    throw new ApiConfigError(
      '운영 빌드는 API_MODE를 명시해야 합니다. 배포는 real, 검증·시연용 목 빌드는 mock + ALLOW_MOCK_IN_PRODUCTION=true를 지정해 주십시오.',
    );
  }
  return resolveApiConfig(rawEnv);
}
