/**
 * JS에서 쓰는 화면 폭 기준. 값은 packages/ui/src/tokens.css의 --breakpoint-* 와 같아야 하며,
 * breakpoints.test.ts가 두 값이 어긋나지 않는지 확인합니다.
 */
export const BREAKPOINTS = {
  /** 모바일웹 디자인 기준 폭(390px) */
  mweb: '24.375rem',
  /** 데스크톱 디자인을 적용하는 폭(1024px) */
  lg: '64rem',
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/** 브레이크포인트 이상인지 묻는 미디어 쿼리 문자열을 만드는 함수(Tailwind 접두사 lg: 와 같은 조건) */
export function minWidthQuery(breakpointName: BreakpointName): string {
  return `(min-width: ${BREAKPOINTS[breakpointName]})`;
}
