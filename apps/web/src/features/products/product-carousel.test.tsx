import type { Product } from '@eum/api/types';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_CAROUSEL_PAGE_SIZE,
  HOME_CAROUSEL_LAYOUTS,
  HOME_WIDE_DESKTOP_QUERY,
  ProductCarouselTrack,
  useCarouselPaging,
  useHomeCarouselLayout,
} from './product-carousel';

const mediaQueryState = vi.hoisted(() => ({ isDesktop: false, isWideDesktop: false }));

vi.mock('@/lib/use-media-query', () => ({
  DESKTOP_QUERY: '(min-width: 64rem)',
  useMediaQuery: (query: string) =>
    query === '(min-width: 80rem)' ? mediaQueryState.isWideDesktop : mediaQueryState.isDesktop,
}));

vi.mock('./product-card', () => ({
  ProductCard: ({
    product,
    className,
    cardVariant,
  }: {
    product: Product;
    className?: string;
    cardVariant?: 'default' | 'home-carousel';
  }) => (
    <article data-product-id={product.id} data-card-variant={cardVariant} className={className} />
  ),
}));

const products = Array.from({ length: 8 }, (_, index) => ({ id: `product-${index}` }) as Product);

beforeEach(() => {
  mediaQueryState.isDesktop = false;
  mediaQueryState.isWideDesktop = false;
});

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

  it('7개와 8개 경계를 처리하고 뷰포트 변경 후 현재 상품이 포함된 페이지를 보존합니다', () => {
    const initialProps: { productCount: number; pageSize: number } = {
      productCount: 7,
      pageSize: HOME_CAROUSEL_LAYOUTS.wideDesktop.pageSize,
    };
    const { result, rerender } = renderHook(
      ({ productCount, pageSize }: { productCount: number; pageSize: number }) =>
        useCarouselPaging(Math.ceil(productCount / pageSize), pageSize),
      { initialProps },
    );

    expect(result.current).toMatchObject({ pageCount: 1, pageIndex: 0, canGoNext: false });

    rerender({ productCount: 8, pageSize: HOME_CAROUSEL_LAYOUTS.wideDesktop.pageSize });
    expect(result.current).toMatchObject({ pageCount: 2, pageIndex: 0, canGoNext: true });
    act(() => result.current.goToNext());
    expect(result.current).toMatchObject({ pageIndex: 1, canGoNext: false });

    rerender({ productCount: 8, pageSize: HOME_CAROUSEL_LAYOUTS.desktop.pageSize });
    expect(result.current).toMatchObject({ pageCount: 2, pageIndex: 1 });
    act(() => result.current.goToPrevious());
    expect(result.current.pageIndex).toBe(0);
    act(() => result.current.goToNext());
    expect(result.current.pageIndex).toBe(1);

    rerender({ productCount: 8, pageSize: HOME_CAROUSEL_LAYOUTS.wideDesktop.pageSize });
    expect(result.current.pageIndex).toBe(0);
    act(() => result.current.resetPaging());
    expect(result.current).toMatchObject({ pageIndex: 0, direction: 'none' });
  });
});

describe('useHomeCarouselLayout', () => {
  it('uses a five-card stride below 1280px and a seven-card stride at 1280px and wider', () => {
    const { result, rerender } = renderHook(
      ({ isWideDesktop }) => {
        mediaQueryState.isWideDesktop = isWideDesktop;
        return useHomeCarouselLayout();
      },
      { initialProps: { isWideDesktop: false } },
    );

    expect(HOME_WIDE_DESKTOP_QUERY).toBe('(min-width: 80rem)');
    expect(result.current).toEqual(HOME_CAROUSEL_LAYOUTS.desktop);
    expect(result.current.pageSize).toBe(5);

    rerender({ isWideDesktop: true });
    expect(result.current).toEqual(HOME_CAROUSEL_LAYOUTS.wideDesktop);
    expect(result.current.pageSize).toBe(7);
  });
});

describe('ProductCarouselTrack responsive layouts', () => {
  it('keeps the shared recommendation track at five cards and 24px gaps', () => {
    mediaQueryState.isDesktop = true;
    render(
      <ProductCarouselTrack products={products} pageIndex={1} direction="next" label="추천 상품" />,
    );

    const track = screen.getByRole('list', { name: '추천 상품' });
    const cards = within(track).getAllByRole('listitem');
    expect(track).toHaveClass('lg:auto-cols-[calc((100%-96px)/5)]', 'lg:gap-x-24');
    expect(track).toHaveStyle({ '--carousel-page': '1' });
    expect(
      cards.slice(0, DESKTOP_CAROUSEL_PAGE_SIZE).every((card) => card.hasAttribute('inert')),
    ).toBe(true);
    expect(cards.slice(DESKTOP_CAROUSEL_PAGE_SIZE).some((card) => card.hasAttribute('inert'))).toBe(
      false,
    );
    expect(within(track).getAllByRole('article')[0]).toHaveAttribute(
      'data-card-variant',
      'default',
    );
  });

  it.each([
    { name: '1024px', layout: HOME_CAROUSEL_LAYOUTS.desktop, expectedTranslate: '-870px' },
    { name: '1280px+', layout: HOME_CAROUSEL_LAYOUTS.wideDesktop, expectedTranslate: '-1218px' },
  ])(
    'uses the home-only $name card geometry, stride, and inert range',
    ({ layout, expectedTranslate }) => {
      mediaQueryState.isDesktop = true;
      render(
        <ProductCarouselTrack
          products={products}
          pageIndex={1}
          direction="next"
          desktopLayout={layout}
          label="베스트 상품"
        />,
      );

      const track = screen.getByRole('list', { name: '베스트 상품' });
      const cards = within(track).getAllByRole('listitem');
      expect(track).toHaveClass(
        'lg:auto-cols-[var(--home-carousel-card-width)]',
        'lg:gap-x-[var(--home-carousel-gap)]',
        'lg:translate-x-[var(--carousel-page-translate)]',
      );
      expect(track).toHaveStyle({
        '--home-carousel-card-width': '158px',
        '--home-carousel-card-height': '284px',
        '--home-carousel-gap': '16px',
        '--carousel-page-translate': expectedTranslate,
      });
      expect(cards.slice(0, layout.pageSize).every((card) => card.hasAttribute('inert'))).toBe(
        true,
      );
      expect(cards.slice(layout.pageSize).some((card) => card.hasAttribute('inert'))).toBe(false);
      expect(within(track).getAllByRole('article')[0]).toHaveAttribute(
        'data-card-variant',
        'home-carousel',
      );
    },
  );

  it('retains the mobile two-column grid while home layout is opted in', () => {
    render(
      <ProductCarouselTrack
        products={products}
        pageIndex={0}
        direction="none"
        mobileLayout="grid"
        desktopLayout={HOME_CAROUSEL_LAYOUTS.wideDesktop}
        label="베스트 상품"
      />,
    );

    const track = screen.getByRole('list', { name: '베스트 상품' });
    expect(track).toHaveClass('grid-rows-2');
  });
});
