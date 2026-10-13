'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { minWidthQuery } from './breakpoints';

/** 감속 모드(애니메이션 줄이기) 미디어 쿼리 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
/** 데스크톱 디자인을 적용하는 폭(Tailwind lg: 와 같은 조건, 값은 breakpoints.ts 한 곳에서 관리) */
export const DESKTOP_QUERY = minWidthQuery('lg');

/**
 * 미디어 쿼리 일치 여부를 구독하는 훅.
 * 서버 렌더와 첫 하이드레이션에서는 serverValue를 돌려주고, 이후 실제 값으로 바꿉니다.
 */
export function useMediaQuery(mediaQuery: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQueryList = window.matchMedia(mediaQuery);
      mediaQueryList.addEventListener('change', onChange);
      return () => mediaQueryList.removeEventListener('change', onChange);
    },
    [mediaQuery],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(mediaQuery).matches,
    () => serverValue,
  );
}

/** 사용자가 감속 모드를 켰는지 돌려주는 훅. 서버 렌더에서는 false로 시작합니다. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

/** 감속 모드에 맞춘 스크롤 동작. 감속 모드면 즉시('auto'), 아니면 부드럽게('smooth') 이동합니다. */
export function getScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth';
}
