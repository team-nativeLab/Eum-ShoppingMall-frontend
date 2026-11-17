'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { PagedResult, Product } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { cx } from '@eum/ui/lib/cx';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { PageContainer } from '@/components/page-container';
import { getScrollBehavior, usePrefersReducedMotion } from '@/lib/use-media-query';
import { ProductCard } from './product-card';
import { useProductsQuery } from './use-products-query';
import { useRecommendedProductsQuery } from './use-recommended-products-query';

/** 베스트·오늘의 상품 화면에서 한 페이지에 보여 줄 상품 수 */
const COLLECTION_PAGE_SIZE = 24;
/** 추천상품 화면에 고정으로 보여 줄 상품 수. 페이지네이션은 없습니다. */
const RECOMMENDED_PAGE_LIMIT = 48;
const SKELETON_COUNT = 8;

/** 베스트·오늘의 상품·추천상품 전용 화면 그리드. 1280px(xl) 이상에서만 5열이며, 로딩 스켈레톤과 목록이 같은 값을 씁니다. */
const GRID_CLASS =
  'grid grid-cols-2 gap-x-12 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-24 lg:gap-y-40 xl:grid-cols-5';

/** 전용 화면 공통 틀. 제목과 본문만 둡니다(필터·정렬·탭·개수·브레드크럼 없음). */
function CollectionFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageContainer className="pt-24 pb-56 lg:pt-48">
      <h1 className="text-h1 lg:text-display">{title}</h1>
      {children}
    </PageContainer>
  );
}

/**
 * 서버 응답의 전체 개수로 페이지 수를 계산합니다. 데이터가 없으면 undefined입니다.
 * totalCount·pageSize가 정상 숫자가 아니면 undefined를 돌려줘 직전에 확인한 값을 유지하게 합니다.
 * 처음부터 비정상이면 호출부의 초기값(1페이지)이 쓰입니다. NaN을 상태로 두면 렌더마다 갱신되어 수렴하지 않습니다.
 */
function getPageCount(data: PagedResult<Product> | undefined): number | undefined {
  if (!data) return undefined;
  if (!Number.isFinite(data.totalCount) || !Number.isFinite(data.pageSize)) return undefined;
  return Math.max(1, Math.ceil(data.totalCount / Math.max(1, data.pageSize)));
}

/** 상품 그리드의 로딩·오류·빈 상태·목록을 한 곳에서 정합니다. */
function CollectionResults({
  isLoading,
  isError,
  error,
  products,
  emptyTitle,
  onRetry,
  onFirstPage,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  products: Product[];
  emptyTitle: string;
  /** 오류 안내에 다시 시도 버튼을 둘 때 넘깁니다(페이지 이동이 있는 화면). */
  onRetry?: () => void;
  /** 오류 안내에 첫 페이지로 버튼을 둘 때 넘깁니다. */
  onFirstPage?: () => void;
}) {
  if (isLoading) {
    return (
      <div aria-busy="true" className={GRID_CLASS}>
        {Array.from({ length: SKELETON_COUNT }, (_, skeletonIndex) => (
          <div
            key={skeletonIndex}
            className="flex aspect-[181/284] min-h-max flex-col rounded-8 border border-line bg-bg p-8"
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
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-12">
        <NoticeInline tone="danger" role="alert">
          {getApiFailureKind(error) === 'notImplemented'
            ? '상품 조회 기능을 준비하고 있습니다.'
            : '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
        </NoticeInline>
        {onRetry || onFirstPage ? (
          <div className="flex flex-wrap gap-8">
            {onRetry ? (
              <Button variant="secondary" size="m" onClick={onRetry}>
                다시 시도
              </Button>
            ) : null}
            {onFirstPage ? (
              <Button variant="secondary" size="m" onClick={onFirstPage}>
                첫 페이지로
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-12 border border-line">
        <EmptyState
          icon={SearchX}
          title={emptyTitle}
          action={
            <Link
              href="/search"
              className="inline-flex h-48 items-center rounded-8 border border-line-strong px-16 text-label-m focus-ring hover:bg-surface"
            >
              전체 상품 보기
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ul className={GRID_CLASS}>
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <ProductCard product={product} layout="grid" className="h-full" />
        </li>
      ))}
    </ul>
  );
}

/** 베스트·오늘의 상품 전용 화면. 기존 목록과 같은 페이지 단위로 조회하고 페이지 번호로 이동합니다. */
export function PagedProductCollectionView({
  title,
  collection,
  emptyTitle,
}: {
  title: string;
  collection: 'featured' | 'today';
  emptyTitle: string;
}) {
  const [page, setPage] = useState(1);
  const prefersReducedMotion = usePrefersReducedMotion();
  // 페이지를 바꾸는 동안 이전 결과를 남겨 두어 페이지 이동 버튼(포커스)이 사라지지 않게 합니다.
  const productsQuery = useProductsQuery(
    { collection, page, pageSize: COLLECTION_PAGE_SIZE },
    { shouldKeepPreviousData: true },
  );
  const isRefreshing = productsQuery.isPlaceholderData;
  const pageCountFromData = getPageCount(productsQuery.data);
  // 요청이 실패하면 데이터가 없어 페이지 수를 알 수 없으므로, 마지막으로 확인한 값을 유지해 페이지 이동이 사라지지 않게 합니다.
  const [knownPageCount, setKnownPageCount] = useState(1);
  if (pageCountFromData !== undefined && pageCountFromData !== knownPageCount) {
    setKnownPageCount(pageCountFromData);
  }
  const pageCount = pageCountFromData ?? knownPageCount;
  // 목록이 줄어 현재 페이지가 범위를 벗어나면 1페이지로 되돌립니다. 이전 결과를 임시로 보여 주는 동안은 판단하지 않습니다.
  const isPageOutOfRange =
    !productsQuery.isPlaceholderData && pageCountFromData !== undefined && page > pageCountFromData;
  if (isPageOutOfRange) setPage(1);
  // 재시도·첫 페이지로를 누르면 오류 블록과 버튼이 스켈레톤으로 바뀌어 사라집니다. 그래서 포커스는 항상 남아 있는 결과 영역으로 옮깁니다.
  const resultsRef = useRef<HTMLDivElement>(null);
  // preventScroll: 포커스 이동이 목록 위치를 위로 튀게 하지 않습니다.
  const focusResults = () => resultsRef.current?.focus({ preventScroll: true });

  return (
    <CollectionFrame title={title}>
      <div
        ref={resultsRef}
        role="region"
        aria-label="상품 목록"
        tabIndex={-1}
        className={cx(
          'mt-8 focus-ring transition-opacity motion-reduce:transition-none sm:mt-16',
          isRefreshing && 'opacity-60',
        )}
        aria-busy={isRefreshing || undefined}
      >
        <CollectionResults
          isLoading={productsQuery.isPending}
          isError={productsQuery.isError}
          error={productsQuery.error}
          products={productsQuery.data?.items ?? []}
          emptyTitle={emptyTitle}
          onRetry={() => {
            focusResults();
            void productsQuery.refetch();
          }}
          onFirstPage={
            page > 1
              ? () => {
                  focusResults();
                  setPage(1);
                }
              : undefined
          }
        />
      </div>
      <Pagination
        currentPage={page}
        totalPages={pageCount}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          // 포커스는 누른 페이지 버튼에 그대로 두고 화면만 목록 위로 올립니다.
          window.scrollTo({ top: 0, behavior: getScrollBehavior(prefersReducedMotion) });
        }}
        className="mt-40 flex justify-center lg:mt-64"
      />
    </CollectionFrame>
  );
}

/** 추천상품 전용 화면. 추천 API에서 고정 개수만 받으며 페이지네이션은 두지 않습니다. */
export function RecommendedProductCollectionView({
  title,
  emptyTitle,
}: {
  title: string;
  emptyTitle: string;
}) {
  const recommendedProductsQuery = useRecommendedProductsQuery({
    limit: RECOMMENDED_PAGE_LIMIT,
  });

  return (
    <CollectionFrame title={title}>
      <div className="mt-8 sm:mt-16">
        <CollectionResults
          isLoading={recommendedProductsQuery.isPending}
          isError={recommendedProductsQuery.isError}
          error={recommendedProductsQuery.error}
          products={recommendedProductsQuery.data ?? []}
          emptyTitle={emptyTitle}
        />
      </div>
    </CollectionFrame>
  );
}
