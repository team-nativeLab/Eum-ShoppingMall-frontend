import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SLIDE_TRANSITION_MS, useHeroSlides } from './use-hero-slides';

describe('useHeroSlides', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('다음으로 이동하면 전환 시간 동안 이전 배너가 leaving이고, 끝나면 사라집니다', () => {
    const { result } = renderHook(() => useHeroSlides(3, false));
    act(() => result.current.showAdjacentSlide(1));
    expect(result.current).toMatchObject({ activeIndex: 1, leavingIndex: 0, direction: 'next' });

    act(() => vi.advanceTimersByTime(HERO_SLIDE_TRANSITION_MS));
    expect(result.current).toMatchObject({ activeIndex: 1, leavingIndex: null });
  });

  it('전환 중 연타는 마지막 요청 하나만 큐에 넣었다가 전환이 끝나면 실행합니다', () => {
    const { result } = renderHook(() => useHeroSlides(4, false));
    act(() => result.current.showAdjacentSlide(1));
    act(() => {
      result.current.showSlide(3);
      result.current.showAdjacentSlide(-1);
      result.current.showSlide(2);
    });
    // 전환 중에는 상태가 바뀌지 않습니다.
    expect(result.current).toMatchObject({ activeIndex: 1, leavingIndex: 0 });

    act(() => vi.advanceTimersByTime(HERO_SLIDE_TRANSITION_MS));
    expect(result.current).toMatchObject({ activeIndex: 2, leavingIndex: 1, direction: 'next' });

    act(() => vi.advanceTimersByTime(HERO_SLIDE_TRANSITION_MS));
    expect(result.current).toMatchObject({ activeIndex: 2, leavingIndex: null });
  });

  it('큐에 넣은 요청이 현재 배너와 같으면 추가 전환 없이 끝납니다', () => {
    const { result } = renderHook(() => useHeroSlides(3, false));
    act(() => result.current.showSlide(1));
    act(() => result.current.showSlide(1));
    act(() => vi.advanceTimersByTime(HERO_SLIDE_TRANSITION_MS));
    expect(result.current).toMatchObject({ activeIndex: 1, leavingIndex: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('이전으로 이동하면 처음에서 마지막 배너로 돌아가고 방향은 previous입니다', () => {
    const { result } = renderHook(() => useHeroSlides(3, false));
    act(() => result.current.showAdjacentSlide(-1));
    expect(result.current).toMatchObject({ activeIndex: 2, direction: 'previous' });
  });

  it('감속 모드에서는 leaving 없이 즉시 바꾸고 타이머를 만들지 않습니다', () => {
    const { result } = renderHook(() => useHeroSlides(3, true));
    act(() => result.current.showAdjacentSlide(1));
    act(() => result.current.showAdjacentSlide(1));
    expect(result.current).toMatchObject({ activeIndex: 2, leavingIndex: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('언마운트하면 진행 중인 전환 타이머를 정리합니다', () => {
    const { result, unmount } = renderHook(() => useHeroSlides(3, false));
    act(() => result.current.showAdjacentSlide(1));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('슬라이드 수가 줄면 현재 번호를 범위 안으로 보정하고, 1개 이하면 이동하지 않습니다', () => {
    const { result, rerender } = renderHook(({ slideCount }) => useHeroSlides(slideCount, false), {
      initialProps: { slideCount: 3 },
    });
    act(() => result.current.showSlide(2));
    act(() => vi.advanceTimersByTime(HERO_SLIDE_TRANSITION_MS));
    rerender({ slideCount: 1 });
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.showAdjacentSlide(1));
    expect(result.current.leavingIndex).toBeNull();
  });
});
