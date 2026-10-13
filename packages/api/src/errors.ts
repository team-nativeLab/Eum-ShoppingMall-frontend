import { ApiConfigError } from './config';

export { ApiConfigError };

/** API 호출 실패를 화면에서 구분하기 위한 오류 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** 오류 종류. 화면 문구는 이 코드를 보고 고릅니다. */
export type ApiErrorCode =
  'NOT_FOUND' | 'NETWORK' | 'NOT_IMPLEMENTED' | 'INVALID_CREDENTIALS' | 'VALIDATION';

// 다시 시도해도 결과가 같은 오류 코드
const NON_RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set([
  'NOT_FOUND',
  'NOT_IMPLEMENTED',
  'INVALID_CREDENTIALS',
  'VALIDATION',
]);

/** 다시 시도할 가치가 있는 오류인지. 설정 오류·요청 취소·확정적 실패는 false입니다. */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiConfigError) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof ApiError) return !NON_RETRYABLE_CODES.has(error.code);
  return true;
}

/**
 * TanStack Query retry 옵션용 함수. 재시도 가능한 오류만 maxRetryCount번까지 다시 시도합니다.
 * 예: retry: (failureCount, error) => shouldRetryQuery(failureCount, error)
 */
export function shouldRetryQuery(failureCount: number, error: unknown, maxRetryCount = 1): boolean {
  return failureCount < maxRetryCount && isRetryableError(error);
}

/** 화면에 보여 줄 조회 실패 문구 종류 */
export type ApiFailureKind = 'config' | 'notImplemented' | 'notFound' | 'temporary';

/** 오류를 화면 문구 종류로 나누는 함수. 설정 오류는 "다시 시도" 대신 문의 안내를 보여 줍니다. */
export function getApiFailureKind(error: unknown): ApiFailureKind {
  if (error instanceof ApiConfigError) return 'config';
  if (error instanceof ApiError && error.code === 'NOT_IMPLEMENTED') return 'notImplemented';
  if (error instanceof ApiError && error.code === 'NOT_FOUND') return 'notFound';
  return 'temporary';
}
