'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { BrandSummary } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { Store } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/page-container';
import { buildBrandDetailHref } from '@/features/products/product-navigation';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandLogo } from './brand-media';
import { useBrandsQuery } from './use-brands-query';

/**
 * 브랜드 목록 화면(/brands)입니다. 브랜드 카드 그리드만 보여 주며,
 * 카드를 누르면 그 브랜드 페이지(/brands/[brandId])로 이동합니다.
 */
export function BrandDirectoryView() {
  const brandsQuery = useBrandsQuery();

  return (
    <>
      <PageContainer className="flex flex-col gap-8 py-24 lg:gap-24 lg:pt-40 lg:pb-48">
        <Breadcrumb
          items={[{ label: '홈', href: '/' }, { label: '브랜드' }]}
          className="hidden lg:block"
          renderLink={(item, className) => (
            <Link href={item.href} className={className}>
              {item.label}
            </Link>
          )}
        />
        <div className="flex flex-col gap-8 lg:gap-12">
          <div className="flex items-baseline gap-8 lg:gap-12">
            <h1 className="text-h1 lg:text-web-display-l">브랜드</h1>
            {brandsQuery.data ? (
              <p className="text-label-s text-text-3">브랜드 {brandsQuery.data.length}개</p>
            ) : null}
          </div>
          <p className="text-body-s text-text-2 lg:text-web-body-xl">
            현장에서 검증한 안전용품 브랜드를 한곳에 모았습니다.
          </p>
        </div>
      </PageContainer>
      <section aria-labelledby="brand-directory-heading" className="pb-32 lg:pb-56">
        <h2 id="brand-directory-heading" className="sr-only">
          전체 브랜드
        </h2>
        {brandsQuery.isPending ? (
          <PageContainer className="pt-24 lg:pt-48">
            <div aria-busy="true" className="grid grid-cols-2 gap-12 lg:grid-cols-6 lg:gap-24">
              {Array.from({ length: 12 }, (_, index) => (
                <div
                  key={index}
                  className="h-164 animate-pulse rounded-8 border border-line bg-surface"
                />
              ))}
            </div>
          </PageContainer>
        ) : brandsQuery.isError ? (
          <PageContainer className="pt-16 lg:pt-24">
            <BrandDirectoryError
              error={brandsQuery.error}
              onRetry={() => void brandsQuery.refetch()}
            />
          </PageContainer>
        ) : brandsQuery.data.length === 0 ? (
          <EmptyState
            icon={Store}
            title="등록된 브랜드가 없습니다"
            description="브랜드가 등록되면 이곳에 표시합니다."
            headingLevel="h3"
          />
        ) : (
          <PageContainer className="pt-24 lg:pt-48">
            <ul className="grid grid-cols-2 gap-12 lg:grid-cols-6 lg:gap-24">
              {brandsQuery.data.map((brand) => (
                <li key={brand.id} className="min-w-0">
                  <BrandTile brand={brand} />
                </li>
              ))}
            </ul>
          </PageContainer>
        )}
      </section>
    </>
  );
}

function BrandDirectoryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const failureKind = getApiFailureKind(error);
  const errorCopy = BRAND_LOAD_ERROR_COPY[failureKind];
  return (
    <NoticeInline tone="danger" role="alert">
      {errorCopy.title}. {errorCopy.description}
      {failureKind === 'temporary' ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-8 min-h-32 rounded-4 px-8 text-label-s underline focus-ring"
        >
          다시 시도
        </button>
      ) : null}
    </NoticeInline>
  );
}

/**
 * 브랜드 타일. 타일 전체가 하나의 링크이며, 누르면 브랜드 페이지(/brands/[brandId])로 이동합니다.
 * Tab 순서: 타일 하나가 정지점 하나입니다.
 */
function BrandTile({ brand }: { brand: BrandSummary }) {
  return (
    <Link
      href={buildBrandDetailHref(brand.id)}
      aria-label={`${brand.name}, 제품 ${brand.productCount}개`}
      className={cx(
        // 높이 계산: 테두리 4 + 패딩 24(12×2) + 로고 줄 60 + 간격 8 + 이름 두 줄 예약 48 + 간격 4 + 개수 줄 16 = 164(h-164).
        'flex h-164 w-full flex-col gap-8 overflow-hidden rounded-8 border-2 border-line bg-bg p-12 text-left shadow-1 focus-ring transition-colors hover:border-text-accent-black',
      )}
    >
      <span className="flex h-60 w-full items-center justify-center">
        <span className="flex h-60 w-full max-w-120 items-center justify-center overflow-hidden rounded-4 bg-surface">
          <BrandLogo
            logoUrl={brand.logoUrl}
            brandName={brand.name}
            className="size-full"
            settings={brand.logoSettings}
          />
        </span>
      </span>
      <span className="flex w-full min-w-0 flex-col gap-4">
        {/* 이름은 두 줄 높이를 항상 예약해, 한 줄 이름과 두 줄 이름 카드의 이름 시작 위치가 같게 합니다. */}
        <span className="line-clamp-2 min-h-48 text-title break-words text-text-1">
          {brand.name}
        </span>
        <span className="text-caption text-text-3">
          제품 {brand.productCount.toLocaleString('ko-KR')}개
        </span>
      </span>
    </Link>
  );
}
