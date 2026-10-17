'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { PageContainer } from '@/components/page-container';
import { useState } from 'react';
import Link from 'next/link';
import { SearchX, Star } from 'lucide-react';
import { useProductQuery } from './use-product-query';
import { useProductReviewsQuery } from './use-product-reviews-query';
import { useProductReviewSummaryQuery } from './use-product-review-summary-query';
import { ProductRatingStars } from './product-rating-stars';

const PAGE_SIZE = 5;
const REVIEW_RATINGS = [5, 4, 3, 2, 1] as const;

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 미제공';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function Failure({ onRetry, message }: { onRetry?: () => void; message: string }) {
  return (
    <NoticeInline tone="danger" role="alert">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <span>{message}</span>
        {onRetry ? (
          <Button size="s" variant="secondary" onClick={onRetry}>
            다시 시도
          </Button>
        ) : null}
      </div>
    </NoticeInline>
  );
}

export function ProductReviewsPage({ productId }: { productId: string }) {
  const [page, setPage] = useState(1);
  const productQuery = useProductQuery(productId);
  const summaryQuery = useProductReviewSummaryQuery(productId);
  const reviewsQuery = useProductReviewsQuery(productId, { page, pageSize: PAGE_SIZE });

  if (productQuery.isPending)
    return (
      <PageContainer className="py-64">
        <p role="status" className="text-center text-body-s text-text-3">
          상품 정보를 불러오는 중입니다.
        </p>
      </PageContainer>
    );
  if (productQuery.isError)
    return (
      <PageContainer className="py-64">
        <section className="mx-auto max-w-560 text-center">
          <h1 className="text-h3">
            {getApiFailureKind(productQuery.error) === 'notFound'
              ? '상품을 찾을 수 없습니다.'
              : getApiFailureKind(productQuery.error) === 'notImplemented'
                ? '실제 상품 조회 API는 아직 연결되지 않았습니다.'
                : '상품 정보를 불러오지 못했습니다.'}
          </h1>
          <Link
            href="/search"
            className="mt-20 inline-flex min-h-48 items-center rounded-8 border border-line-strong px-16 focus-ring"
          >
            상품 목록으로
          </Link>
        </section>
      </PageContainer>
    );

  const product = productQuery.data;
  const totalCount = reviewsQuery.data?.totalCount ?? product.reviewCount;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const reviews = reviewsQuery.data?.items ?? [];

  return (
    <PageContainer className="px-16 pt-24 pb-64 sm:px-20 lg:pt-40 lg:pb-80">
      <nav aria-label="현재 위치" className="mb-20 text-caption text-text-3">
        <Link href={`/products/${encodeURIComponent(product.id)}`} className="rounded-4 focus-ring">
          상품 상세
        </Link>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span aria-current="page">리뷰</span>
      </nav>
      <header className="border-b border-line pb-24">
        <p className="text-caption text-text-3">{product.brand}</p>
        <h1 className="mt-8 text-h1">{product.name} 리뷰</h1>
      </header>
      {summaryQuery.isSuccess ? (
        <section
          aria-label="리뷰 통계"
          className="my-24 grid gap-20 rounded-12 bg-surface p-20 sm:grid-cols-[200px_minmax(0,1fr)] sm:p-24 lg:my-32 lg:grid-cols-[260px_minmax(0,1fr)] lg:p-32"
        >
          <div className="flex flex-col items-center justify-center border-b border-line pb-20 sm:border-r sm:border-b-0 sm:pr-20 sm:pb-0">
            <p className="text-caption text-text-3">전체 평점</p>
            <strong className="mt-8 text-web-display-l">
              {summaryQuery.data.averageRating?.toFixed(1) ?? '—'}
            </strong>
            <ProductRatingStars rating={summaryQuery.data.averageRating ?? 0} />
            <span className="mt-8 text-caption text-text-3">
              리뷰 {summaryQuery.data.totalCount.toLocaleString('ko-KR')}개
            </span>
          </div>
          <div className="space-y-8" aria-label="별점별 리뷰 수">
            {REVIEW_RATINGS.map((rating) => {
              const count = summaryQuery.data.ratingCounts[rating];
              const width =
                summaryQuery.data.totalCount === 0
                  ? 0
                  : Math.min(100, (count / summaryQuery.data.totalCount) * 100);
              return (
                <div
                  key={rating}
                  className="grid grid-cols-[32px_minmax(0,1fr)_48px] items-center gap-8 text-caption"
                >
                  <span>{rating}점</span>
                  <div className="h-8 overflow-hidden rounded-capsule bg-surface-2">
                    <div
                      className="h-full rounded-capsule bg-rating-star-fill"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {summaryQuery.isPending ? (
        <p role="status" className="my-24 text-center text-body-s text-text-3">
          리뷰 요약을 불러오는 중입니다.
        </p>
      ) : null}
      {summaryQuery.isError ? (
        <Failure
          message={
            getApiFailureKind(summaryQuery.error) === 'notImplemented'
              ? '전체 리뷰 요약은 준비 중입니다.'
              : '리뷰 요약을 불러오지 못했습니다.'
          }
          onRetry={
            getApiFailureKind(summaryQuery.error) === 'temporary'
              ? () => void summaryQuery.refetch()
              : undefined
          }
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-12 border-b border-line pb-16">
        <h2 className="text-h3">
          전체 리뷰 <span className="text-text-3">{totalCount}</span>
        </h2>
        <div role="group" aria-label="리뷰 종류" className="flex gap-8">
          <button
            type="button"
            aria-pressed="true"
            className="min-h-40 rounded-capsule border border-text-1 bg-text-1 px-14 text-label-s text-inverse focus-ring"
          >
            전체
          </button>
          <button
            type="button"
            disabled
            aria-describedby="photo-review-unavailable-note"
            className="min-h-40 cursor-not-allowed rounded-capsule border border-line px-14 text-label-s text-text-disabled disabled:opacity-70"
          >
            <span className="inline-flex items-center gap-4">
              <Star size={14} aria-hidden="true" />
              포토 리뷰
            </span>
          </button>
        </div>
      </div>
      <p id="photo-review-unavailable-note" className="mt-8 text-caption text-text-3">
        사진 리뷰 데이터가 연결되기 전까지 포토 리뷰를 제공하지 않습니다.
      </p>
      {reviewsQuery.isPending ? (
        <p role="status" className="py-40 text-center text-body-s text-text-3">
          리뷰를 불러오는 중입니다.
        </p>
      ) : null}
      {reviewsQuery.isError ? (
        <Failure
          message={
            getApiFailureKind(reviewsQuery.error) === 'notImplemented'
              ? '리뷰 조회 기능을 준비하고 있습니다.'
              : '리뷰를 불러오지 못했습니다.'
          }
          onRetry={
            getApiFailureKind(reviewsQuery.error) === 'temporary'
              ? () => void reviewsQuery.refetch()
              : undefined
          }
        />
      ) : null}
      {reviewsQuery.isSuccess && reviews.length === 0 ? (
        <EmptyState
          className="py-40"
          icon={SearchX}
          title="아직 작성된 리뷰가 없습니다"
          description="구매 후 첫 리뷰를 남겨 주세요."
          headingLevel="h3"
        />
      ) : null}
      {reviewsQuery.isSuccess && reviews.length > 0 ? (
        <ul aria-label="전체 리뷰" className="divide-y divide-line border-b border-line">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="grid gap-8 py-20 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-16 lg:py-24"
            >
              <time
                className="text-caption text-text-3"
                dateTime={
                  Number.isNaN(new Date(review.createdAt).getTime()) ? undefined : review.createdAt
                }
              >
                {formatReviewDate(review.createdAt)}
              </time>
              <div>
                <div className="flex flex-wrap items-center gap-8">
                  <span className="text-label-m">{review.authorName}</span>
                  <ProductRatingStars rating={review.rating} />
                </div>
                {review.optionLabel ? (
                  <p className="mt-8 text-caption text-text-3">옵션 · {review.optionLabel}</p>
                ) : null}
                <p className="mt-12 text-body-m whitespace-pre-line">{review.content}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {reviewsQuery.isSuccess && pageCount > 1 ? (
        <nav aria-label="리뷰 페이지" className="mt-24 flex items-center justify-center gap-12">
          <Button
            variant="secondary"
            size="s"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            이전
          </Button>
          <span aria-live="polite" className="text-caption tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="s"
            disabled={page >= pageCount || reviewsQuery.isPlaceholderData}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            다음
          </Button>
        </nav>
      ) : null}
      <div className="mt-32 flex justify-center">
        <Link
          href={`/products/${encodeURIComponent(product.id)}`}
          className="inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
        >
          상품 상세로
        </Link>
      </div>
    </PageContainer>
  );
}
