'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { SearchX } from 'lucide-react';
import { useState } from 'react';
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
  const reviewsQuery = useProductReviewsQuery(productId, { page, pageSize: REVIEW_PAGE_SIZE });
  const totalCount = reviewsQuery.data?.totalCount ?? reviewCount;
  const pageCount = Math.max(1, Math.ceil(totalCount / REVIEW_PAGE_SIZE));

  return (
    <section
      id={sectionId}
      aria-labelledby="reviews-heading"
      aria-busy={reviewsQuery.isPending}
      className="flex scroll-mt-120 flex-col gap-16"
    >
      <h2 id="reviews-heading" className="text-h3">
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
          <ul className="border-t border-line">
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
            onPageChange={setPage}
            className="flex justify-center"
          />
        </>
      )}
    </section>
  );
}
