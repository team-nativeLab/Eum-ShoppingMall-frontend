'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { ProductReview } from '@eum/api/types';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { cx } from '@eum/ui/lib/cx';
import { SearchX, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
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

function formatReviewDate(value: string) {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '날짜 미제공' : REVIEW_DATE_FORMAT.format(parsedDate);
}

function ProductReviewCard({ review }: { review: ProductReview }) {
  const reportDescriptionId = useId();
  const formattedDate = formatReviewDate(review.createdAt);

  return (
    <li className="flex gap-12 border-b border-line py-24 sm:gap-16">
      <div
        aria-hidden="true"
        className="flex size-40 shrink-0 items-center justify-center rounded-capsule bg-surface-2 text-text-3"
      >
        <Icon icon={UserRound} size={20} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-12">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <span className="text-label-m">{review.authorName}</span>
          <time
            dateTime={
              Number.isNaN(new Date(review.createdAt).getTime()) ? undefined : review.createdAt
            }
            className="text-caption text-text-3"
          >
            {formattedDate}
          </time>
        </div>
        <ProductRatingStars rating={review.rating} />
        <p className="text-body-m whitespace-pre-line">{review.content}</p>
        {review.adminReply ? (
          <div className="rounded-8 bg-surface p-12 text-body-s">
            <p className="font-medium">판매자 답변</p>
            <p className="mt-4 whitespace-pre-line">{review.adminReply}</p>
          </div>
        ) : null}
        {review.optionLabel ? (
          <p className="text-caption text-text-3">옵션 · {review.optionLabel}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-8 border-t border-line pt-12">
          <p id={reportDescriptionId} className="text-caption text-text-3">
            신고 접수 기능은 준비 중입니다
          </p>
          <button
            type="button"
            disabled
            aria-label={`${review.authorName} ${formattedDate} 리뷰 신고하기`}
            aria-describedby={reportDescriptionId}
            className="inline-flex min-h-36 shrink-0 items-center justify-center rounded-8 border border-line bg-surface px-12 text-label-m text-text-3 disabled:cursor-not-allowed"
          >
            신고하기
          </button>
        </div>
      </div>
    </li>
  );
}

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
  brand,
}: {
  productId: string;
  /** 상품 응답의 리뷰 수(제목 표시용). 목록을 불러오면 목록의 전체 수를 씁니다. */
  reviewCount: number;
  sectionId: string;
  brand: string;
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
      <div className="flex flex-wrap items-center justify-between gap-8">
        <h2 id="reviews-heading" ref={headingRef} tabIndex={-1} className="text-h3 focus-ring">
          리뷰 ({totalCount.toLocaleString('ko-KR')})
        </h2>
        <Link
          href={`/products/${encodeURIComponent(productId)}/reviews`}
          className="rounded-4 text-label-s underline focus-ring"
        >
          리뷰 전체 보기
        </Link>
      </div>
      <p className="-mt-8 text-caption text-text-3">브랜드: {brand}</p>
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
              <ProductReviewCard key={review.id} review={review} />
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
