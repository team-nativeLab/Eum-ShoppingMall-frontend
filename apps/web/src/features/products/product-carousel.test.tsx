import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCarouselPaging } from './product-carousel';

describe('useCarouselPaging', () => {
  it('다음·이전 이동 방향을 기록하고 범위를 벗어나지 않습니다', () => {
    const { result } = renderHook(() => useCarouselPaging(3));
    expect(result.current).toMatchObject({ pageIndex: 0, direction: 'none', canGoPrevious: false });

    act(() => result.current.goToNext());
    expect(result.current).toMatchObject({ pageIndex: 1, direction: 'next' });

    act(() => result.current.goToPage(0));
    expect(result.current).toMatchObject({ pageIndex: 0, direction: 'previous' });

    act(() => result.current.goToPage(10));
    expect(result.current).toMatchObject({ pageIndex: 2, direction: 'next', canGoNext: false });
  });

  it('페이지 수가 줄면 마지막 페이지로 보정하고, reset은 방향 없이 처음으로 돌아갑니다', () => {
    const { result, rerender } = renderHook(({ pageCount }) => useCarouselPaging(pageCount), {
      initialProps: { pageCount: 3 },
    });
    act(() => result.current.goToPage(2));
    rerender({ pageCount: 2 });
    expect(result.current.pageIndex).toBe(1);

    act(() => result.current.resetPaging());
    expect(result.current).toMatchObject({ pageIndex: 0, direction: 'none' });
  });
});
