'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Store } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/page-container';
import { ProductListingView } from '@/features/products/product-listing-view';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { useBrandQuery } from './use-brand-query';

const BRAND_LIST_LINK_CLASS =
  'inline-flex h-48 items-center rounded-8 border border-line-strong px-16 text-label-m focus-ring hover:bg-surface';

/**
 * 브랜드 전용 제품 목록(/brands/[brandId]/products)입니다.
 * 브랜드 이름이 확정되기 전에는 전체 상품이 잠깐 보이지 않도록 목록을 그리지 않고 스켈레톤만 둡니다.
 */
export function BrandProductsView({ brandId }: { brandId: string }) {
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
      return (
        <PageContainer className="py-40">
          <h1 className="sr-only">브랜드 제품</h1>
          <EmptyState
            icon={Store}
            title={errorCopy.title}
            description={errorCopy.description}
            action={
              <Link href="/brands" className={BRAND_LIST_LINK_CLASS}>
                브랜드 목록 보기
              </Link>
            }
          />
        </PageContainer>
      );
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

  // 브랜드 이름으로 고정 필터를 걸고, 제목은 브랜드명으로 씁니다(빵부스러기는 두지 않습니다).
  return (
    <ProductListingView
      key={brand.id}
      initialBrands={[brand.name]}
      lockedBrand={brand.name}
      pageTitle={brand.name}
      hideBreadcrumb
      backLink={{ href: '/brands', label: '브랜드 목록' }}
    />
  );
}
