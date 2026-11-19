import type { Product } from '@eum/api/types';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_CAROUSEL_PAGE_SIZE,
  HOME_CAROUSEL_LAYOUTS,
  HOME_WIDE_DESKTOP_QUERY,
  getHomeCarouselCardWidth,
  getHomeCarouselPageTranslate,
  ProductCarouselTrack,
  useCarouselPaging,
  useHomeCarouselLayout,
} from './product-carousel';

const mediaQueryState = vi.hoisted(() => ({
  isDesktop: false,
  isMediumDesktop: false,
  isWideDesktop: false,
}));

vi.mock('@/lib/use-media-query', () => ({
  DESKTOP_QUERY: '(min-width: 64rem)',
  useMediaQuery: (query: string) =>
    query === '(min-width: 80rem)'
      ? mediaQueryState.isWideDesktop
      : query.includes('max-width: 79.99rem')
        ? mediaQueryState.isMediumDesktop
        : mediaQueryState.isDesktop,
}));

vi.mock('./product-card', () => ({
  ProductCard: ({
    product,
    className,
    mobileVariant,
    cardVariant,
  }: {
    product: Product;
    className?: string;
    mobileVariant?: 'full' | 'compact';
    cardVariant?: 'default' | 'home-carousel';
  }) => (
    <article
      data-product-id={product.id}
      data-mobile-variant={mobileVariant}
      data-card-variant={cardVariant}
      className={className}
    />
  ),
}));

const products = Array.from({ length: 13 }, (_, index) => ({ id: `product-${index}` }) as Product);

beforeEach(() => {
  mediaQueryState.isDesktop = false;
  mediaQueryState.isMediumDesktop = false;
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

  it('5개와 8개 경계를 처리하고 뷰포트 변경 후 현재 상품이 포함된 페이지를 보존합니다', () => {
    const initialProps: { productCount: number; pageSize: number } = {
      productCount: 5,
      pageSize: HOME_CAROUSEL_LAYOUTS.wideDesktop.pageSize,
    };
    const { result, rerender } = renderHook(
      ({ productCount, pageSize }: { productCount: number; pageSize: number }) =>
        useCarouselPaging(Math.ceil(productCount / pageSize), pageSize),
      { initialProps },
    );

    expect(result.current).toMatchObject({ pageCount: 1, pageIndex: 0, canGoNext: false });

    rerender({ productCount: 20, pageSize: HOME_CAROUSEL_LAYOUTS.wideDesktop.pageSize });
    expect(result.current).toMatchObject({ pageCount: 2, pageIndex: 0, canGoNext: true });
    act(() => result.current.goToNext());
    expect(result.current).toMatchObject({ pageIndex: 1, canGoNext: false });

    rerender({ productCount: 20, pageSize: HOME_CAROUSEL_LAYOUTS.desktop.pageSize });
    expect(result.current).toMatchObject({ pageCount: 3, pageIndex: 1 });
    act(() => result.current.goToPrevious());
    expect(result.current.pageIndex).toBe(0);
    act(() => result.current.goToNext());
    expect(result.current.pageIndex).toBe(1);

    rerender({ productCount: 20, pageSize: HOME_CAROUSEL_LAYOUTS.wideDesktop.pageSize });
    expect(result.current.pageIndex).toBe(0);
    act(() => result.current.resetPaging());
    expect(result.current).toMatchObject({ pageIndex: 0, direction: 'none' });
  });
});

describe('useHomeCarouselLayout', () => {
  it('uses mobile 2×2, 1024–1279 4×2 and 1280+ 5×2 page geometry', () => {
    const { result, rerender } = renderHook(
      ({ viewport }: { viewport: 'mobile' | 'medium' | 'wide' }) => {
        mediaQueryState.isDesktop = viewport !== 'mobile';
        mediaQueryState.isMediumDesktop = viewport === 'medium';
        mediaQueryState.isWideDesktop = viewport === 'wide';
        return useHomeCarouselLayout();
      },
      { initialProps: { viewport: 'medium' as 'mobile' | 'medium' | 'wide' } },
    );

    expect(HOME_WIDE_DESKTOP_QUERY).toBe('(min-width: 80rem)');
    expect(result.current).toEqual(HOME_CAROUSEL_LAYOUTS.desktop);
    expect(result.current).toMatchObject({ pageSize: 8, columns: 4, rows: 2 });

    rerender({ viewport: 'wide' });
    expect(result.current).toEqual(HOME_CAROUSEL_LAYOUTS.wideDesktop);
    expect(result.current).toMatchObject({ pageSize: 10, columns: 5, rows: 2 });

    rerender({ viewport: 'mobile' });
    expect(result.current).toMatchObject({ pageSize: 4, columns: 2, rows: 2 });
  });
});

describe('getHomeCarouselCardWidth', () => {
  it('reserves both arrow gutters and the column gaps in the responsive rail width', () => {
    expect(getHomeCarouselCardWidth(HOME_CAROUSEL_LAYOUTS.desktop)).toContain('- 176px) / 4');
    expect(getHomeCarouselCardWidth(HOME_CAROUSEL_LAYOUTS.wideDesktop)).toContain('- 192px) / 5');
  });
});

describe('getHomeCarouselPageTranslate', () => {
  it.each([
    { layout: HOME_CAROUSEL_LAYOUTS.desktop, steps: 4 },
    { layout: HOME_CAROUSEL_LAYOUTS.wideDesktop, steps: 5 },
  ])(
    'moves exactly one page using the responsive card width ($steps columns)',
    ({ layout, steps }) => {
      const stride = ['var(--home-carousel-card-width)', 'var(--home-carousel-gap)'];
      expect(getHomeCarouselPageTranslate(0, layout)).toBe('0px');
      expect(getHomeCarouselPageTranslate(1, layout)).toBe(
        `calc(0px - ${Array.from({ length: steps }, () => stride)
          .flat()
          .join(' - ')})`,
      );
      expect(
        getHomeCarouselPageTranslate(2, layout).match(/var\(--home-carousel-card-width\)/g),
      ).toHaveLength(steps * 2);
    },
  );
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
    expect(
      cards
        .slice(DESKTOP_CAROUSEL_PAGE_SIZE, DESKTOP_CAROUSEL_PAGE_SIZE * 2)
        .some((card) => card.hasAttribute('inert')),
    ).toBe(false);
    expect(
      cards.slice(DESKTOP_CAROUSEL_PAGE_SIZE * 2).every((card) => card.hasAttribute('inert')),
    ).toBe(true);
    expect(within(track).getAllByRole('article')[0]).toHaveAttribute(
      'data-card-variant',
      'default',
    );
  });

  it.each([
    {
      name: '1024px',
      layout: HOME_CAROUSEL_LAYOUTS.desktop,
      expectedPageSize: 8,
      expectedTranslate: getHomeCarouselPageTranslate(1, HOME_CAROUSEL_LAYOUTS.desktop),
    },
    {
      name: '1280px+',
      layout: HOME_CAROUSEL_LAYOUTS.wideDesktop,
      expectedPageSize: 10,
      expectedTranslate: getHomeCarouselPageTranslate(1, HOME_CAROUSEL_LAYOUTS.wideDesktop),
    },
  ])(
    'uses the home-only $name card geometry, stride, and inert range',
    ({ layout, expectedPageSize, expectedTranslate }) => {
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
        'lg:grid-rows-[minmax(0,max-content)_minmax(0,max-content)]',
      );
      expect(track).not.toHaveClass(
        'lg:grid-rows-1',
        'lg:grid-rows-[minmax(0,292px)]',
        'lg:h-[292px]',
        'lg:min-h-[292px]',
      );
      expect(track).toHaveStyle({
        '--home-carousel-card-width': getHomeCarouselCardWidth(layout),
        '--home-carousel-card-min-height': '284px',
        '--home-carousel-gap': '16px',
        '--carousel-page-translate': expectedTranslate,
      });
      expect(layout.cardWidth).toBe(220);
      expect(layout.minCardHeight).toBe(284);
      expect(layout.gap).toBe(16);
      expect(layout.pageSize).toBe(expectedPageSize);
      expect(layout.columns).toBe(expectedPageSize / 2);
      expect(cards.slice(0, layout.pageSize).every((card) => card.hasAttribute('inert'))).toBe(
        true,
      );
      expect(cards.slice(layout.pageSize).some((card) => card.hasAttribute('inert'))).toBe(false);
      const finalCard = cards.at(-1);
      expect(finalCard).toHaveStyle(
        layout.columns === 4
          ? { '--desktop-column': '5', '--desktop-row': '2' }
          : { '--desktop-column': '8', '--desktop-row': '1' },
      );
      expect(cards[0]).not.toHaveClass('h-[292px]', 'lg:h-[292px]');
      expect(within(track).getAllByRole('article')[0]).toHaveAttribute(
        'data-card-variant',
        'home-carousel',
      );
    },
  );

  it('uses compact home cards in a two-column grid and keeps a partial last row within the track', () => {
    render(
      <ProductCarouselTrack
        products={products.slice(0, 3)}
        pageIndex={0}
        direction="none"
        mobileLayout="grid"
        desktopLayout={HOME_CAROUSEL_LAYOUTS.wideDesktop}
        label="베스트 상품"
      />,
    );

    const track = screen.getByRole('list', { name: '베스트 상품' });
    expect(track).toHaveClass(
      'grid-rows-2',
      'auto-cols-[calc((100%-12px)/2)]',
      'gap-x-12',
      'gap-y-16',
    );
    expect(screen.getByTestId('product-carousel')).toHaveClass('overflow-x-auto');
    const cards = within(track).getAllByRole('article');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card).toHaveClass('h-full');
      expect(card).toHaveAttribute('data-mobile-variant', 'compact');
      expect(card).toHaveAttribute('data-card-variant', 'home-carousel');
    }
    const items = within(track).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveClass('min-w-0', 'snap-start');
    expect(items[0]).toHaveStyle({ '--mobile-column': '1', '--mobile-row': '1' });
    expect(items[1]).toHaveStyle({ '--mobile-column': '2', '--mobile-row': '1' });
    expect(items[2]).toHaveStyle({ '--mobile-column': '1', '--mobile-row': '2' });
    expect(items[0]).toHaveStyle({ '--desktop-column': '1', '--desktop-row': '1' });
    expect(items[1]).toHaveStyle({ '--desktop-column': '2', '--desktop-row': '1' });
    expect(items[2]).toHaveStyle({ '--desktop-column': '3', '--desktop-row': '1' });
  });
});
