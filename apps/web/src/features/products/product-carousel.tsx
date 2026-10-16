'use client';

import type { Product } from '@eum/api/types';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { ProductCard } from './product-card';

/** 공용 추천 캐러셀의 데스크톱 한 페이지 카드 수(Figma 240 카드 5열) */
export const DESKTOP_CAROUSEL_PAGE_SIZE = 5;

/** Tailwind 기본 xl 브레이크포인트(80rem). W-01 홈에서 7개를 한 번에 이동하는 기준입니다. */
export const HOME_WIDE_DESKTOP_QUERY = '(min-width: 80rem)';

/** 홈 베스트 셀러 전용 데스크톱 레이아웃. 공유 추천 캐러셀은 기존 5열 규격을 유지합니다. */
export const HOME_CAROUSEL_LAYOUTS = {
  desktop: { pageSize: 5, cardWidth: 158, cardHeight: 368, gap: 16 },
  wideDesktop: { pageSize: 7, cardWidth: 158, cardHeight: 368, gap: 16 },
} as const;

export type CarouselDesktopLayout = {
  pageSize: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
};

/** 홈만 Tailwind xl(1280px)에서 7장 이동으로 전환합니다. */
export function useHomeCarouselLayout(): CarouselDesktopLayout {
  return useMediaQuery(HOME_WIDE_DESKTOP_QUERY)
    ? HOME_CAROUSEL_LAYOUTS.wideDesktop
    : HOME_CAROUSEL_LAYOUTS.desktop;
}

/** 마지막 이동 방향. 처음에는 이동한 적이 없어 'none'입니다. */
export type CarouselDirection = 'next' | 'previous' | 'none';

/**
 * 캐러셀 페이지 상태를 관리하는 훅.
 * 이동 방향(next/previous)을 함께 기록해 트랙이 같은 방향으로 미끄러지게 하고,
 * 항목 수가 줄어 현재 페이지가 사라지면 마지막 페이지로 보정합니다.
 */
export function useCarouselPaging(pageCount: number, pageSize?: number) {
  const [pageState, setPageState] = useState<{
    pageAnchorIndex: number;
    direction: CarouselDirection;
  }>({ pageAnchorIndex: 0, direction: 'none' });
  const lastPageIndex = Math.max(0, pageCount - 1);
  const requestedPageIndex = pageSize
    ? Math.floor(pageState.pageAnchorIndex / pageSize)
    : pageState.pageAnchorIndex;
  const pageIndex = Math.min(requestedPageIndex, lastPageIndex);

  // 지정한 페이지로 이동하는 함수. 인덱스 차이로 방향을 정합니다.
  const goToPage = (targetIndex: number) => {
    const boundedTarget = Math.min(Math.max(targetIndex, 0), lastPageIndex);
    if (boundedTarget === pageIndex) return;
    setPageState({
      pageAnchorIndex: boundedTarget * (pageSize ?? 1),
      direction: boundedTarget > pageIndex ? 'next' : 'previous',
    });
  };

  // 탭·필터가 바뀌어 처음부터 다시 보여 줄 때 쓰는 함수(애니메이션 없이 첫 페이지로)
  const resetPaging = () => setPageState({ pageAnchorIndex: 0, direction: 'none' });

  return {
    pageIndex,
    pageCount,
    direction: pageState.direction,
    canGoPrevious: pageIndex > 0,
    canGoNext: pageIndex < lastPageIndex,
    goToPage,
    goToNext: () => goToPage(pageIndex + 1),
    goToPrevious: () => goToPage(pageIndex - 1),
    resetPaging,
  };
}

/** 모바일 배치: 'grid'는 2×2 페이지(W-01m 베스트 셀러), 'row'는 카드 2개 폭의 한 줄 스와이프입니다. */
type MobileCarouselLayout = 'grid' | 'row';

// 모바일 2×2 배치에서 한 페이지에 들어가는 카드 수
const MOBILE_GRID_PAGE_SIZE = 4;

/**
 * 상품 카드 캐러셀 트랙.
 * - 데스크톱(lg 이상): 기본은 5열 한 줄, 전용 layout이 있으면 해당 화면 규격으로 이동합니다.
 *   현재 페이지 밖 카드는 inert로 포커스·클릭에서 뺍니다.
 * - 모바일: 가로 스크롤 + scroll-snap으로 스와이프합니다(새 의존성 없이 CSS만 사용).
 */
export function ProductCarouselTrack({
  products,
  pageIndex,
  direction,
  mobileLayout = 'row',
  desktopLayout,
  label,
  className,
}: {
  products: Product[];
  pageIndex: number;
  direction: CarouselDirection;
  mobileLayout?: MobileCarouselLayout;
  /** 주입하면 해당 화면만 전용 카드 크기·이동 거리를 사용합니다. */
  desktopLayout?: CarouselDesktopLayout;
  /** 트랙 목록 이름(화면낭독기용) */
  label: string;
  className?: string;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const activePageSize = desktopLayout?.pageSize ?? DESKTOP_CAROUSEL_PAGE_SIZE;
  const pageStart = pageIndex * activePageSize;
  const pageEnd = pageStart + activePageSize;
  const isMobileGrid = mobileLayout === 'grid';
  const carouselTranslate =
    pageIndex * activePageSize * ((desktopLayout?.cardWidth ?? 0) + (desktopLayout?.gap ?? 0));
  const trackStyle = desktopLayout
    ? ({
        '--home-carousel-card-width': `${desktopLayout.cardWidth}px`,
        '--home-carousel-card-height': `${desktopLayout.cardHeight}px`,
        '--home-carousel-gap': `${desktopLayout.gap}px`,
        '--carousel-page-translate': `${-carouselTranslate}px`,
      } as CSSProperties)
    : ({ '--carousel-page': pageIndex } as CSSProperties);

  return (
    <div
      data-testid="product-carousel"
      data-direction={direction}
      className={cx(
        // relative: 카드 안 sr-only(absolute) 요소가 스크롤 영역 밖으로 빠져 페이지 폭을 늘리지 않게 합니다.
        'relative snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto lg:snap-none lg:overflow-hidden',
        className,
      )}
    >
      <ul
        aria-label={label}
        data-testid="product-carousel-track"
        style={trackStyle}
        className={cx(
          'grid auto-cols-[calc((100%-12px)/2)] grid-flow-col gap-x-12 gap-y-16',
          isMobileGrid ? 'grid-rows-2' : 'grid-rows-1',
          desktopLayout
            ? 'lg:translate-x-[var(--carousel-page-translate)] lg:auto-cols-[var(--home-carousel-card-width)] lg:grid-rows-1 lg:gap-x-[var(--home-carousel-gap)]'
            : 'lg:translate-x-[calc(var(--carousel-page)*(-100%_-_24px))] lg:auto-cols-[calc((100%-96px)/5)] lg:grid-rows-1 lg:gap-x-24',
          // 감속 모드에서는 transition을 붙이지 않아 즉시 이동합니다.
          'lg:motion-safe:transition-[translate] lg:motion-safe:duration-500 lg:motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        )}
      >
        {products.map((product, productIndex) => {
          const isOnDesktopPage = productIndex >= pageStart && productIndex < pageEnd;
          // 모바일 2×2: 카드 4개를 한 페이지(2열×2행)로 묶고 행 우선 순서로 놓습니다.
          const mobilePageIndex = Math.floor(productIndex / MOBILE_GRID_PAGE_SIZE);
          const positionInPage = productIndex % MOBILE_GRID_PAGE_SIZE;
          const mobileGridStyle = isMobileGrid
            ? ({
                '--mobile-column': mobilePageIndex * 2 + (positionInPage % 2) + 1,
                '--mobile-row': Math.floor(positionInPage / 2) + 1,
              } as CSSProperties)
            : undefined;
          const isSnapPoint = isMobileGrid ? positionInPage === 0 : true;
          return (
            <li
              key={product.id}
              style={mobileGridStyle}
              inert={isDesktop && !isOnDesktopPage}
              className={cx(
                'min-w-0',
                isSnapPoint && 'snap-start',
                isMobileGrid &&
                  'col-start-(--mobile-column) row-start-(--mobile-row) lg:col-start-auto lg:row-start-auto',
              )}
            >
              <ProductCard
                product={product}
                mobileVariant="compact"
                cardVariant={desktopLayout ? 'home-carousel' : 'default'}
                className="h-full"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 원형 이전/다음 버튼(Figma SectionHeader 40px · line-strong 테두리) */
export function CarouselArrowButton({
  icon,
  label,
  onClick,
  isDisabled,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  isDisabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      className={cx(
        'inline-flex size-40 items-center justify-center rounded-capsule border border-line-strong bg-bg focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:text-text-disabled',
        className,
      )}
    >
      <Icon icon={icon} size={20} />
    </button>
  );
}

/**
 * HF/Web/SectionHeader + 5열 상품 캐러셀(상품 상세 "함께 구매하면 좋은 제품", 검색 없음 "추천 상품").
 * 데스크톱은 제목 오른쪽에 전체 보기·이전/다음 버튼, 모바일은 스와이프로 넘깁니다.
 */
export function ProductCarouselSection({
  headingId,
  title,
  products,
  viewAllHref,
  itemLabel,
  className,
}: {
  headingId: string;
  title: string;
  products: Product[];
  viewAllHref: string;
  /** 버튼·목록 이름에 쓰는 대상 이름(예: "함께 구매하면 좋은 제품") */
  itemLabel: string;
  className?: string;
}) {
  const carouselPaging = useCarouselPaging(Math.ceil(products.length / DESKTOP_CAROUSEL_PAGE_SIZE));
  if (products.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="flex min-h-40 items-center justify-between gap-16">
        <h2 id={headingId} className="text-h3 lg:text-h1">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-16">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-4 rounded-4 text-label-m focus-ring hover:text-text-2"
          >
            전체 보기
            <Icon icon={ArrowRight} size={16} />
          </Link>
          {carouselPaging.pageCount > 1 ? (
            <div className="hidden items-center gap-8 lg:flex">
              <CarouselArrowButton
                icon={ChevronLeft}
                label={`이전 ${itemLabel}`}
                onClick={carouselPaging.goToPrevious}
                isDisabled={!carouselPaging.canGoPrevious}
              />
              <CarouselArrowButton
                icon={ChevronRight}
                label={`다음 ${itemLabel}`}
                onClick={carouselPaging.goToNext}
                isDisabled={!carouselPaging.canGoNext}
              />
            </div>
          ) : null}
        </div>
      </div>
      <ProductCarouselTrack
        products={products}
        pageIndex={carouselPaging.pageIndex}
        direction={carouselPaging.direction}
        label={itemLabel}
        className="mt-16 lg:mt-24"
      />
      <p aria-live="polite" className="sr-only">
        {carouselPaging.direction === 'none'
          ? ''
          : `${carouselPaging.pageCount}페이지 중 ${carouselPaging.pageIndex + 1}페이지`}
      </p>
    </section>
  );
}
