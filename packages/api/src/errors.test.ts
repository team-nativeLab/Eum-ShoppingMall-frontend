import { describe, expect, it } from 'vitest';
import {
  ApiConfigError,
  ApiError,
  getApiFailureKind,
  isRetryableError,
  shouldRetryQuery,
} from './errors';

describe('재시도 판단', () => {
  it('설정 오류·취소·확정적 실패는 다시 시도하지 않습니다', () => {
    expect(isRetryableError(new ApiConfigError('설정'))).toBe(false);
    expect(isRetryableError(new DOMException('취소', 'AbortError'))).toBe(false);
    expect(isRetryableError(new ApiError('NOT_IMPLEMENTED', '스텁'))).toBe(false);
    expect(isRetryableError(new ApiError('NOT_FOUND', '없음'))).toBe(false);
  });

  it('네트워크 오류는 정해진 횟수까지 다시 시도합니다', () => {
    const networkError = new ApiError('NETWORK', '일시 오류');
    expect(shouldRetryQuery(0, networkError)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(false);
  });
});

describe('getApiFailureKind', () => {
  it('오류 종류별로 화면 문구 종류를 나눕니다', () => {
    expect(getApiFailureKind(new ApiConfigError('설정'))).toBe('config');
    expect(getApiFailureKind(new ApiError('NOT_IMPLEMENTED', '스텁'))).toBe('notImplemented');
    expect(getApiFailureKind(new ApiError('NOT_FOUND', '없음'))).toBe('notFound');
    expect(getApiFailureKind(new Error('기타'))).toBe('temporary');
  });
});
