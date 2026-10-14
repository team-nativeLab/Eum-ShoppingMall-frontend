import { describe, expect, it } from 'vitest';
import { formatAdminDateInput, isInvalidAdminDateInput, parseAdminDateInput } from './AdminUI';

describe('관리자 날짜 입력', () => {
  it('숫자 입력을 YYYY.MM.DD 표시 형식으로 변환한다', () => {
    expect(formatAdminDateInput('20260308')).toBe('2026.03.08');
    expect(formatAdminDateInput('2026.03.08abc')).toBe('2026.03.08');
  });

  it('유효한 날짜를 현지 날짜 키로 변환한다', () => {
    expect(parseAdminDateInput('2026.03.08')).toBe('2026-03-08');
    expect(isInvalidAdminDateInput('2026.03.08')).toBe(false);
    expect(isInvalidAdminDateInput('')).toBe(false);
  });

  it('존재하지 않는 날짜와 미완성 날짜를 잘못된 입력으로 판별한다', () => {
    expect(parseAdminDateInput('2026.02.29')).toBe('');
    expect(isInvalidAdminDateInput('2026.02.29')).toBe(true);
    expect(isInvalidAdminDateInput('2026.03.')).toBe(true);
    expect(isInvalidAdminDateInput('2026.13.01')).toBe(true);
  });
});
