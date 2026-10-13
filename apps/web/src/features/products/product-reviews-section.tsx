'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { cx } from '@eum/ui/lib/cx';
import { SearchX } from 'lucide-react';
import { useRef, useState } from 'react';
import { getScrollBehavior, usePrefersReducedMotion } from '@/lib/use-media-query';
import { ProductRatingStars } from './product-rating-stars';
import { useProductReviewsQuery } from './use-product-reviews-query';

/** 리뷰 한 페이지 수 */
const REVIEW_PAGE_SIZE = 5;

const REVIEW_DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

/**
 * 상품 상세 리뷰 섹션. 리뷰 API로 목록을 불러와 로딩·에러·빈 상태를 나눠 보여 줍니다.
 * 빈 상태는 Figma W-03 "아직 작성된 리뷰가 없습니다 / 구매 후 첫 리뷰를 남겨 주세요."입니다.
 * 페이지를 옮기면 이전 페이지를 흐리게 둔 채 새 페이지를 받고, 섹션 맨 위로 스크롤하며 제목으로 포커스를 옮깁니다.
 * 리뷰가 줄어 현재 페이지가 범위를 벗어나면 마지막 페이지로 보정합니다.
 */
export function ProductReviewsSection({
  productId,
  reviewCount,
  sectionId,
}: {
  productId: string;
  /** 상품 응답의 리뷰 수(제목 표시용). 목록을 불러오면 목록의 전체 수를 씁니다. */
  reviewCount: number;
  sectionId: string;
}) {
  const [page, setPage] = useState(1);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const reviewsQuery = useProductReviewsQuery(productId, { page, pageSize: REVIEW_PAGE_SIZE });
  const totalCount = reviewsQuery.data?.totalCount ?? reviewCount;
  // 페이지 수는 서버가 적용한 pageSize로 계산합니다.
  const appliedPageSize = Math.max(1, reviewsQuery.data?.pageSize ?? REVIEW_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(totalCount / appliedPageSize));
  const isRefreshing = reviewsQuery.isPlaceholderData;

  // 최신 응답 기준으로 현재 페이지가 마지막 페이지를 넘으면(리뷰 삭제 등) 마지막 페이지로 되돌립니다.
  // 렌더 중 상태 보정이라 effect 없이 한 번 더 렌더하고 끝납니다.
  if (reviewsQuery.data && !isRefreshing && page > pageCount) {
    setPage(pageCount);
  }

  // 페이지를 옮기고 섹션 맨 위로 스크롤한 뒤, 제목으로 포커스를 옮겨 새 목록을 처음부터 읽게 하는 함수
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    sectionRef.current?.scrollIntoView({
      behavior: getScrollBehavior(prefersReducedMotion),
      block: 'start',
    });
    headingRef.current?.focus({ preventScroll: true });
  };

  return (
    <section
      ref={sectionRef}
      id={sectionId}
      aria-labelledby="reviews-heading"
      aria-busy={reviewsQuery.isPending || isRefreshing}
      className="flex scroll-mt-120 flex-col gap-16 lg:scroll-mt-136"
    >
      <h2 id="reviews-heading" ref={headingRef} tabIndex={-1} className="text-h3 focus-ring">
        리뷰 ({totalCount.toLocaleString('ko-KR')})
      </h2>
      {reviewsQuery.isPending ? (
        <div className="flex flex-col gap-12">
          {Array.from({ length: 2 }, (_, skeletonIndex) => (
            <div key={skeletonIndex} className="h-96 animate-pulse rounded-12 bg-surface" />
          ))}
        </div>
      ) : reviewsQuery.isError ? (
        <NoticeInline tone="danger" role="alert">
          {getApiFailureKind(reviewsQuery.error) === 'notImplemented'
            ? '리뷰 조회 기능을 준비하고 있습니다.'
            : '리뷰를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
        </NoticeInline>
      ) : reviewsQuery.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="아직 작성된 리뷰가 없습니다"
          description="구매 후 첫 리뷰를 남겨 주세요."
          headingLevel="h3"
        />
      ) : (
        <>
          <ul
            aria-label="리뷰 목록"
            className={cx(
              'border-t border-line transition-opacity motion-reduce:transition-none',
              isRefreshing && 'opacity-60',
            )}
          >
            {reviewsQuery.data.items.map((review) => (
              <li key={review.id} className="flex flex-col gap-8 border-b border-line py-20">
                <div className="flex flex-wrap items-center gap-8">
                  <ProductRatingStars rating={review.rating} />
                  <span className="text-caption-medium">{review.authorName}</span>
                  <time dateTime={review.createdAt} className="text-caption text-text-3">
                    {REVIEW_DATE_FORMAT.format(new Date(review.createdAt))}
                  </time>
                </div>
                {review.optionLabel ? (
                  <p className="text-caption text-text-3">{review.optionLabel}</p>
                ) : null}
                <p className="text-body-m whitespace-pre-line">{review.content}</p>
              </li>
            ))}
          </ul>
          <Pagination
            currentPage={page}
            totalPages={pageCount}
            onPageChange={changePage}
            className="flex justify-center"
          />
        </>
      )}
    </section>
  );
}
