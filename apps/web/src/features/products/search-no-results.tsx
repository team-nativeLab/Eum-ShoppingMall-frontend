'use client';

import { buttonClassName } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { cx } from '@eum/ui/lib/cx';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/page-container';
import { ProductCarouselSection } from './product-carousel';
import { useProductsQuery } from './use-products-query';
import { useRecommendedKeywordsQuery } from './use-recommended-keywords-query';

/** 추천 상품 최대 수(5열 × 2페이지) */
const RECOMMENDED_PRODUCT_LIMIT = 10;

/**
 * W-04z 검색 결과 없음. 필터 사이드바 없이 가운데 빈 상태 + 추천 검색어 + 추천 상품 캐러셀을 보여 줍니다.
 * 추천 검색어·추천 상품은 서버 응답으로 채우고, 불러오지 못하면 해당 영역만 숨깁니다.
 */
export function SearchNoResults({ keyword }: { keyword: string }) {
  const recommendedKeywordsQuery = useRecommendedKeywordsQuery();
  const recommendedProductsQuery = useProductsQuery({
    sortBy: 'recommended',
    pageSize: RECOMMENDED_PRODUCT_LIMIT,
  });
  const recommendedKeywords = recommendedKeywordsQuery.data ?? [];

  return (
    <PageContainer className="pt-24 pb-56 lg:pt-48">
      <h1 className="sr-only">‘{keyword}’ 검색 결과</h1>
      <div className="flex flex-col items-center gap-48">
        <EmptyState
          icon={SearchX}
          headingLevel="h2"
          title={`‘${keyword}’에 대한 검색 결과가 없습니다`}
          description="단어의 철자가 정확한지 확인하거나, 더 일반적인 검색어로 다시 검색해 주세요."
          className="w-full max-w-640"
          action={
            <Link
              href="/search"
              className={cx(buttonClassName({ variant: 'secondary', size: 'm' }), 'w-160')}
            >
              전체 상품 보기
            </Link>
          }
        />
        {recommendedKeywords.length > 0 ? (
          <section
            aria-labelledby="recommended-keywords-heading"
            className="flex flex-col items-center gap-12"
          >
            <h2 id="recommended-keywords-heading" className="text-title">
              추천 검색어
            </h2>
            <ul className="flex flex-wrap justify-center gap-8">
              {recommendedKeywords.map((recommendedKeyword) => (
                <li key={recommendedKeyword}>
                  <Link
                    href={'/search?q=' + encodeURIComponent(recommendedKeyword)}
                    className="inline-flex h-36 items-center rounded-capsule border border-line-strong bg-bg px-14 text-label-m whitespace-nowrap text-text-2 focus-ring hover:bg-surface"
                  >
                    {recommendedKeyword}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <ProductCarouselSection
        headingId="recommended-products-heading"
        title="추천 상품"
        itemLabel="추천 상품"
        products={recommendedProductsQuery.data?.items ?? []}
        viewAllHref="/search"
        className="mt-64 lg:mt-96"
      />
    </PageContainer>
  );
}
