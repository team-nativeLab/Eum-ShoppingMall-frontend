'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { CarouselDirection } from './product-carousel';

/** 히어로 슬라이드 전환 시간(ms). CSS 애니메이션은 heroSlideStyle의 CSS 변수로 같은 값을 받습니다. */
export const HERO_SLIDE_TRANSITION_MS = 550;
/** 히어로 슬라이드 전환 easing */
export const HERO_SLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * 히어로 섹션에 붙이는 CSS 변수. globals.css의 slide-enter/slide-leave 애니메이션이 이 값을 읽어
 * JS 타이머(HERO_SLIDE_TRANSITION_MS)와 CSS 전환 시간이 한 곳의 값으로 맞춰집니다.
 */
export const heroSlideStyle = {
  '--hero-slide-duration': `${HERO_SLIDE_TRANSITION_MS}ms`,
  '--hero-slide-easing': HERO_SLIDE_EASING,
} as CSSProperties;

/** 이동 요청: 특정 번호로 / 이전·다음으로 */
type SlideRequest = { kind: 'index'; targetIndex: number } | { kind: 'step'; step: -1 | 1 };

interface HeroSlideState {
  activeIndex: number;
  /** 나가는 중인 배너 번호. 전환 중이 아니면 null */
  leavingIndex: number | null;
  direction: CarouselDirection;
  /** 전환 중에 들어온 마지막 요청(하나만 보관). 전환이 끝나면 실행합니다. */
  queuedRequest: SlideRequest | null;
}

const INITIAL_STATE: HeroSlideState = {
  activeIndex: 0,
  leavingIndex: null,
  direction: 'none',
  queuedRequest: null,
};

/**
 * 요청을 실행한 다음 상태를 계산하는 순수 함수.
 * 같은 배너로 가는 요청은 무시하고, 감속 모드면 나가는 배너 없이 즉시 바꿉니다.
 */
function applyRequest(
  currentState: HeroSlideState,
  slideRequest: SlideRequest,
  slideCount: number,
  isInstant: boolean,
): HeroSlideState {
  const lastIndex = Math.max(0, slideCount - 1);
  const currentIndex = Math.min(currentState.activeIndex, lastIndex);
  const targetIndex =
    slideRequest.kind === 'index'
      ? Math.min(Math.max(slideRequest.targetIndex, 0), lastIndex)
      : (currentIndex + slideRequest.step + slideCount) % Math.max(slideCount, 1);
  if (targetIndex === currentIndex) return { ...currentState, queuedRequest: null };
  const direction =
    slideRequest.kind === 'step'
      ? slideRequest.step === 1
        ? 'next'
        : 'previous'
      : targetIndex > currentIndex
        ? 'next'
        : 'previous';
  return {
    activeIndex: targetIndex,
    leavingIndex: isInstant ? null : currentIndex,
    direction,
    queuedRequest: null,
  };
}

/**
 * 홈 히어로 슬라이드 상태 머신.
 * - 이동하면 현재 배너는 leaving, 새 배너는 active가 되고 HERO_SLIDE_TRANSITION_MS 뒤에 leaving을 끝냅니다.
 * - 전환 중에 들어온 클릭은 마지막 요청 하나만 큐에 넣었다가 전환이 끝나면 실행합니다(연타해도 레이어가 겹치지 않음).
 * - 감속 모드면 전환 없이 즉시 바꿉니다.
 * - 타이머는 언마운트·재전환 때 정리합니다.
 */
export function useHeroSlides(slideCount: number, prefersReducedMotion: boolean) {
  const [slideState, setSlideState] = useState<HeroSlideState>(INITIAL_STATE);
  const lastIndex = Math.max(0, slideCount - 1);
  // 응답이 바뀌어 슬라이드 수가 줄어도 범위를 벗어나지 않게 보정합니다.
  const activeIndex = Math.min(slideState.activeIndex, lastIndex);
  const leavingIndex =
    slideState.leavingIndex !== null && slideState.leavingIndex <= lastIndex
      ? slideState.leavingIndex
      : null;

  // 나가는 배너는 전환 시간이 지나면 숨기고, 큐에 있던 요청을 이어서 실행합니다.
  // (애니메이션 종료 이벤트에 기대지 않아 탭 전환 중에도 끝납니다.)
  useEffect(() => {
    if (slideState.leavingIndex === null) return;
    const finishTimer = window.setTimeout(() => {
      setSlideState((currentState) => {
        const finishedState = { ...currentState, leavingIndex: null, queuedRequest: null };
        return currentState.queuedRequest
          ? applyRequest(
              finishedState,
              currentState.queuedRequest,
              slideCount,
              prefersReducedMotion,
            )
          : finishedState;
      });
    }, HERO_SLIDE_TRANSITION_MS);
    return () => window.clearTimeout(finishTimer);
  }, [slideState.leavingIndex, slideState.activeIndex, slideCount, prefersReducedMotion]);

  // 요청을 바로 실행하거나, 전환 중이면 마지막 요청으로 큐에 넣는 함수
  const requestSlide = (slideRequest: SlideRequest) => {
    if (slideCount <= 1) return;
    setSlideState((currentState) =>
      currentState.leavingIndex !== null
        ? { ...currentState, queuedRequest: slideRequest }
        : applyRequest(currentState, slideRequest, slideCount, prefersReducedMotion),
    );
  };

  return {
    activeIndex,
    leavingIndex,
    direction: slideState.direction,
    showSlide: (targetIndex: number) => requestSlide({ kind: 'index', targetIndex }),
    showAdjacentSlide: (step: -1 | 1) => requestSlide({ kind: 'step', step }),
  };
}
