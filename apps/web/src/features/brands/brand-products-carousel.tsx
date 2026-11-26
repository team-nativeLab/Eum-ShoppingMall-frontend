'use client';

import { type ApiFailureKind, getApiFailureKind } from '@eum/api/errors';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { PageContainer } from '@/components/page-container';
import {
  getHomeCarouselCardWidth,
  ProductCarouselTrack,
  useCarouselPaging,
  useHomeCarouselLayout,
} from '@/features/products/product-carousel';
import { useProductsQuery } from '@/features/products/use-products-query';
import { BRAND_LIST_LINK_CLASS } from './brand-link-classes';

const BRAND_CAROUSEL_HEADING_ID = 'brand-products-heading';
/** 브랜드 상품은 상위 10개만 가져옵니다(홈 와이드 데스크톱 5열×2줄 한 페이지 분량). */
const BRAND_CAROUSEL_PAGE_SIZE = 10;

const PRODUCTS_LOAD_ERROR_COPY: Record<ApiFailureKind, { title: string; description: string }> = {
  config: {
    title: '서비스 설정 문제로 상품을 불러올 수 없습니다',
    description: '관리자에게 문의해 주세요.',
  },
  notImplemented: {
    title: '상품 조회 기능을 준비하고 있습니다',
    description: '조금만 기다려 주세요.',
  },
  notFound: {
    title: '상품을 찾을 수 없습니다',
    description: '잠시 후 다시 시도해 주세요.',
  },
  temporary: {
    title: '상품을 불러오지 못했습니다',
    description: '잠시 후 다시 시도해 주세요.',
  },
};

/**
 * 브랜드 페이지의 상품 캐러셀입니다. 홈 상품 섹션(HomeProductShowcase)과 같은 레이아웃·카드·버튼·스켈레톤을 씁니다.
 * 차이는 두 가지입니다. 시각 제목 대신 sr-only 제목을 두고, 「전체 보기」 링크를 두지 않습니다.
 * 목록이 로드되어 0개이면(상품 수는 0보다 크지만 구매 가능한 목록이 비는 경우) 안내 한 줄과 「다른 브랜드 보기」 링크를 둡니다.
 * 로딩 중에는 스켈레톤을 유지합니다. 상품 수가 0인 브랜드는 호출하는 쪽이 0개 안내로 막습니다.
 */
export function BrandProductsCarousel({ brandName }: { brandName: string }) {
  const productsQuery = useProductsQuery({
    brand: [brandName],
    pageSize: BRAND_CAROUSEL_PAGE_SIZE,
  });
  const desktopLayout = useHomeCarouselLayout();
  const products = productsQuery.data?.items ?? [];
  const carouselPaging = useCarouselPaging(
    Math.ceil(products.length / desktopLayout.pageSize),
    desktopLayout.pageSize,
  );
  const title = `${brandName} 제품`;

  return (
    <PageContainer className="mt-48 lg:mt-64">
      <section aria-labelledby={BRAND_CAROUSEL_HEADING_ID}>
        <h2 id={BRAND_CAROUSEL_HEADING_ID} className="sr-only">
          {title}
        </h2>
        {productsQuery.isPending ? (
          <div
            aria-busy="true"
            data-testid="brand-products-skeleton"
            style={
              {
                '--home-carousel-card-width': getHomeCarouselCardWidth(desktopLayout),
                '--home-carousel-card-min-height': `${desktopLayout.minCardHeight}px`,
                '--home-carousel-gap': `${desktopLayout.gap}px`,
              } as CSSProperties
            }
            className="grid auto-cols-[calc((100%-12px)/2)] grid-flow-col grid-rows-2 gap-x-12 gap-y-16 lg:mx-64 lg:auto-cols-[var(--home-carousel-card-width)] lg:grid-rows-[minmax(0,max-content)_minmax(0,max-content)] lg:gap-x-[var(--home-carousel-gap)]"
          >
            {Array.from({ length: desktopLayout.pageSize }, (_, skeletonIndex) => (
              <div
                key={skeletonIndex}
                style={
                  {
                    '--skeleton-column':
                      Math.floor(skeletonIndex / desktopLayout.pageSize) * desktopLayout.columns +
                      ((skeletonIndex % desktopLayout.pageSize) % desktopLayout.columns) +
                      1,
                    '--skeleton-row':
                      Math.floor((skeletonIndex % desktopLayout.pageSize) / desktopLayout.columns) +
                      1,
                  } as CSSProperties
                }
                className="flex aspect-[181/284] min-h-max min-w-0 flex-col rounded-8 border border-line bg-bg p-8 lg:col-start-(--skeleton-column) lg:row-start-(--skeleton-row) lg:aspect-auto lg:min-h-[var(--home-carousel-card-min-height)]"
              >
                <div className="aspect-[23/20] shrink-0 animate-pulse rounded-6 bg-surface" />
                <div className="flex min-h-0 flex-1 flex-col gap-8 px-4 pt-16">
                  <div className="h-12 w-1/2 animate-pulse rounded-4 bg-surface" />
                  <div className="h-48 animate-pulse rounded-4 bg-surface" />
                  <div className="mt-auto h-16 w-2/3 animate-pulse rounded-4 bg-surface" />
                </div>
              </div>
            ))}
          </div>
        ) : productsQuery.isError ? (
          <BrandProductsError
            error={productsQuery.error}
            onRetry={() => void productsQuery.refetch()}
          />
        ) : products.length === 0 ? (
          <div className="mt-16 flex flex-wrap items-center gap-16 lg:mt-24">
            <p className="text-body-m text-text-2">지금 구매할 수 있는 제품이 없습니다</p>
            <Link href="/brands" className={BRAND_LIST_LINK_CLASS}>
              다른 브랜드 보기
            </Link>
          </div>
        ) : (
          <div className="relative mt-16 lg:mt-24">
            <ProductCarouselTrack
              products={products}
              pageIndex={carouselPaging.pageIndex}
              direction={carouselPaging.direction}
              mobileLayout="grid"
              desktopLayout={desktopLayout}
              label={title}
              className="lg:mx-64"
            />
            {carouselPaging.pageCount > 1 ? (
              <>
                <button
                  type="button"
                  onClick={carouselPaging.goToPrevious}
                  disabled={!carouselPaging.canGoPrevious}
                  aria-label={`이전 ${title}`}
                  className={cx(
                    'absolute top-1/2 left-0 hidden size-52 -translate-y-1/2 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:text-text-disabled lg:inline-flex',
                  )}
                >
                  <Icon icon={ChevronLeft} size={24} />
                </button>
                <button
                  type="button"
                  onClick={carouselPaging.goToNext}
                  disabled={!carouselPaging.canGoNext}
                  aria-label={`다음 ${title}`}
                  className={cx(
                    'absolute top-1/2 right-0 hidden size-52 -translate-y-1/2 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:text-text-disabled lg:inline-flex',
                  )}
                >
                  <Icon icon={ChevronRight} size={24} />
                </button>
                <p aria-live="polite" className="sr-only">
                  {carouselPaging.direction === 'none'
                    ? ''
                    : `${carouselPaging.pageCount}페이지 중 ${carouselPaging.pageIndex + 1}페이지`}
                </p>
              </>
            ) : null}
          </div>
        )}
      </section>
    </PageContainer>
  );
}

/** 상품 목록 조회 실패 안내입니다. 다시 시도는 일시 오류(temporary)에서만 보여 줍니다. */
function BrandProductsError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const failureKind = getApiFailureKind(error);
  const errorCopy = PRODUCTS_LOAD_ERROR_COPY[failureKind];
  return (
    <NoticeInline tone="danger" role="alert" className="mt-16">
      {errorCopy.title}. {errorCopy.description}
      {failureKind === 'temporary' ? (
        <Button variant="secondary" size="s" className="ml-8" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </NoticeInline>
  );
}
