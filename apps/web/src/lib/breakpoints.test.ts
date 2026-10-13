import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, minWidthQuery } from './breakpoints';

// vitest는 저장소 루트에서 실행합니다(jsdom 환경이라 import.meta.url 대신 작업 경로 기준).
const tokensCss = readFileSync(resolve(process.cwd(), 'packages/ui/src/tokens.css'), 'utf8');

// tokens.css에서 --breakpoint-<이름> 값을 읽는 함수
function readTokenBreakpoint(breakpointName: string): string | undefined {
  const tokenPattern = new RegExp(`--breakpoint-${breakpointName}:\\s*([^;]+);`);
  return tokenPattern.exec(tokensCss)?.[1]?.trim();
}

describe('BREAKPOINTS', () => {
  it.each(Object.entries(BREAKPOINTS))('%s 값은 tokens.css와 같습니다', (name, value) => {
    expect(readTokenBreakpoint(name)).toBe(value);
  });

  it('min-width 미디어 쿼리를 만듭니다', () => {
    expect(minWidthQuery('lg')).toBe('(min-width: 64rem)');
  });
});
