'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { ChevronLeft, Store } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/page-container';
import { ProductListingView } from '@/features/products/product-listing-view';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { useBrandQuery } from './use-brand-query';

const BRAND_LIST_LINK_CLASS =
  'inline-flex h-48 items-center rounded-8 border border-line-strong px-16 text-label-m focus-ring hover:bg-surface';

/**
 * 브랜드 페이지(/brands/[brandId])입니다.
 * 상단 헤더(「← 브랜드 목록」, 브랜드 이름, 한 줄 설명, 제품 수)는 이 페이지가 그리고,
 * 본문 상품 목록은 상품 목록 뷰가 그립니다(목록 뷰는 hideHeader로 자기 헤더를 숨깁니다).
 * 상품 목록은 브랜드 이름으로 고정한 필터입니다. 브랜드 카드 목록과 「제품 보기」는 이 페이지에 없습니다.
 * 브랜드 이름이 확정되기 전에는 전체 상품이 잠깐 보이지 않도록 목록을 그리지 않고 스켈레톤만 둡니다.
 */
export function BrandDetailView({ brandId }: { brandId: string }) {
  const brandQuery = useBrandQuery(brandId);

  if (brandQuery.isPending) {
    return (
      <PageContainer className="pt-24 lg:pt-48">
        <div aria-busy="true" className="flex flex-col gap-24">
          <div className="h-40 w-1/3 animate-pulse rounded-4 bg-surface" />
          <div className="grid grid-cols-2 gap-x-12 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-24 lg:gap-y-40">
            {Array.from({ length: 8 }, (_, skeletonIndex) => (
              <div
                key={skeletonIndex}
                className="aspect-[181/284] animate-pulse rounded-8 border border-line bg-surface"
              />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (brandQuery.isError) {
    const failureKind = getApiFailureKind(brandQuery.error);
    const errorCopy = BRAND_LOAD_ERROR_COPY[failureKind];
    if (failureKind === 'notFound') {
      return <BrandNotFoundState />;
    }
    return (
      <PageContainer className="pt-24">
        <NoticeInline tone="danger" role="alert">
          {errorCopy.title}. {errorCopy.description}
          {failureKind === 'temporary' ? (
            <Button variant="secondary" size="s" onClick={() => void brandQuery.refetch()}>
              다시 시도
            </Button>
          ) : null}
        </NoticeInline>
      </PageContainer>
    );
  }

  const brand = brandQuery.data;
  // 이름이 비어 있으면 고정 필터(lockedBrand)가 풀려 전체 상품이 보이므로, 없는 브랜드와 같은 안내로 막습니다.
  if (brand.name.trim() === '') {
    return <BrandNotFoundState />;
  }
  if (brand.productCount === 0) {
    return (
      <PageContainer className="py-40">
        <h1 className="sr-only">{brand.name}</h1>
        <EmptyState
          icon={Store}
          title="이 브랜드의 상품이 없습니다"
          action={
            <Link href="/brands" className={BRAND_LIST_LINK_CLASS}>
              브랜드 목록 보기
            </Link>
          }
        />
      </PageContainer>
    );
  }

  // 헤더(뒤로 링크·이름·설명·제품 수)는 이 페이지가 그리고, 본문은 브랜드 이름으로 고정한 상품 목록입니다.
  // 목록 뷰의 기본 헤더는 숨깁니다(빵부스러기도 두지 않습니다).
  return (
    <>
      <PageContainer className="pt-24">
        <Link
          href="/brands"
          className="inline-flex items-center gap-4 rounded-4 text-label-m text-text-2 focus-ring hover:text-text-1"
        >
          <Icon icon={ChevronLeft} size={16} />
          브랜드 목록
        </Link>
        <header className="mt-16 flex min-w-0 flex-col gap-16">
          <h1 className="min-w-0 text-web-h2 break-words lg:text-web-display-l">{brand.name}</h1>
          {brand.tagline ? (
            <p className="min-w-0 text-body-l break-words text-text-2 lg:text-web-body-xl">
              {brand.tagline}
            </p>
          ) : null}
          <p className="text-body-s text-text-3">
            제품 {brand.productCount.toLocaleString('ko-KR')}개
          </p>
        </header>
      </PageContainer>
      <ProductListingView
        key={brand.id}
        initialBrands={[brand.name]}
        lockedBrand={brand.name}
        pageTitle={brand.name}
        hideHeader
        hideBreadcrumb
      />
    </>
  );
}

/** 없는 브랜드(404 응답 또는 이름이 비어 있는 브랜드)의 안내입니다. 문구는 브랜드 조회 실패 기준(notFound)을 씁니다. */
function BrandNotFoundState() {
  const notFoundCopy = BRAND_LOAD_ERROR_COPY.notFound;
  return (
    <PageContainer className="py-40">
      <h1 className="sr-only">브랜드 제품</h1>
      <EmptyState
        icon={Store}
        title={notFoundCopy.title}
        description={notFoundCopy.description}
        action={
          <Link href="/brands" className={BRAND_LIST_LINK_CLASS}>
            브랜드 목록 보기
          </Link>
        }
      />
    </PageContainer>
  );
}
