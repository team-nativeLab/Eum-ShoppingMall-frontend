'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { Brand } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, ChevronDown, PackageOpen, SearchX, Store } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { PageContainer } from '@/components/page-container';
import { ProductCard } from '@/features/products/product-card';
import { buildBrandHref, buildBrandProductsHref } from '@/features/products/product-navigation';
import { useProductsQuery } from '@/features/products/use-products-query';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandCover, BrandLogo, BrandLogoPanel, getBrandSubline } from './brand-media';
import { useBrandQuery } from './use-brand-query';

/** 상세 화면에 보여 줄 브랜드 상품 수(전체는 「제품 00개 보기」로 상품 목록에서 봅니다) */
export const BRAND_PRODUCT_PREVIEW_COUNT = 8;

// 다크 밴드 위 포커스 표시(home-view QuoteBanner와 같은 방식)
const INVERSE_FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse';

/**
 * W-33 브랜드 상세. 브랜드 히어로 + 스토리 + 이 브랜드 상품(상위 8개)으로 구성합니다.
 * 상품은 브랜드 조회가 끝난 뒤에만 조회해서, 브랜드 이름 없이 전체 상품을 요청하지 않게 합니다.
 */
export function BrandDetailView({ brandId }: { brandId: string }) {
  const brandQuery = useBrandQuery(brandId);

  if (brandQuery.isPending) {
    return (
      <div aria-busy="true">
        <div className="h-400 animate-pulse bg-surface lg:mt-64 lg:h-480" />
        <PageContainer className="mt-48 space-y-16 lg:mt-120">
          <div className="h-24 w-160 animate-pulse rounded-8 bg-surface" />
          <div className="h-120 animate-pulse rounded-12 bg-surface" />
        </PageContainer>
      </div>
    );
  }

  if (brandQuery.isError) {
    const failureKind = getApiFailureKind(brandQuery.error);
    const errorCopy = BRAND_LOAD_ERROR_COPY[failureKind];
    return (
      <PageContainer className="py-40">
        <EmptyState
          icon={failureKind === 'notFound' ? SearchX : Store}
          title={errorCopy.title}
          description={errorCopy.description}
          headingLevel="h2"
          action={
            failureKind === 'temporary' ? (
              <Button variant="secondary" size="m" onClick={() => void brandQuery.refetch()}>
                다시 시도
              </Button>
            ) : (
              <Link href={buildBrandHref()} className={buttonClassName({ variant: 'secondary' })}>
                브랜드 목록 보기
              </Link>
            )
          }
        />
      </PageContainer>
    );
  }

  // 브랜드가 바뀌면 스토리 펼침 상태를 처음으로 되돌립니다.
  return <BrandDetailContent key={brandQuery.data.id} brand={brandQuery.data} />;
}

function BrandDetailContent({ brand }: { brand: Brand }) {
  // TODO(브랜드 ID 필터): 서버가 brandId 필터를 지원하면 이름 필터 대신 brandId로 조회합니다.
  // 히어로 CTA와 상품 그리드가 같은 조회 결과(같은 query key)를 함께 씁니다.
  const productsQuery = useProductsQuery({
    brand: [brand.name],
    pageSize: BRAND_PRODUCT_PREVIEW_COUNT,
  });
  const productTotalCount = productsQuery.data?.totalCount;

  return (
    <>
      <PageContainer className="hidden py-24 lg:block">
        <Breadcrumb
          items={[
            { label: '홈', href: '/' },
            { label: '브랜드', href: buildBrandHref() },
            { label: brand.name },
          ]}
          renderLink={(item, className) => (
            <Link href={item.href} className={className}>
              {item.label}
            </Link>
          )}
        />
      </PageContainer>
      <BrandHero brand={brand} productTotalCount={productTotalCount} />
      <BrandStory brand={brand} />
      <section aria-labelledby="brand-products-heading">
        <PageContainer className="flex flex-col gap-16 py-48 lg:gap-32 lg:py-120">
          <h2
            id="brand-products-heading"
            className="flex items-baseline gap-8 text-h3 lg:gap-12 lg:text-web-h2"
          >
            제품
            {productTotalCount !== undefined ? (
              <span className="lg:text-body-s-medium lg:text-text-3">{productTotalCount}개</span>
            ) : null}
          </h2>
          {productsQuery.isPending ? (
            <ul aria-busy="true" className={PRODUCT_GRID_CLASS}>
              {Array.from({ length: BRAND_PRODUCT_PREVIEW_COUNT }, (_, skeletonIndex) => (
                <li key={skeletonIndex} className="aspect-3/4 animate-pulse rounded-8 bg-surface" />
              ))}
            </ul>
          ) : productsQuery.isError ? (
            <NoticeInline tone="danger" role="alert">
              {getApiFailureKind(productsQuery.error) === 'notImplemented'
                ? '상품 조회 기능을 준비하고 있습니다.'
                : '제품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
              {getApiFailureKind(productsQuery.error) === 'temporary' ? (
                <Button
                  variant="secondary"
                  size="s"
                  className="mt-8"
                  onClick={() => void productsQuery.refetch()}
                >
                  다시 시도
                </Button>
              ) : null}
            </NoticeInline>
          ) : productsQuery.data.items.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="등록된 제품이 없습니다"
              description="다른 브랜드의 제품을 확인해 주세요."
              headingLevel="h3"
              action={
                <Link href={buildBrandHref()} className={buttonClassName({ variant: 'secondary' })}>
                  브랜드 목록 보기
                </Link>
              }
            />
          ) : (
            <>
              <ul className={PRODUCT_GRID_CLASS}>
                {productsQuery.data.items.map((product) => (
                  <li key={product.id} className="min-w-0">
                    <ProductCard product={product} mobileVariant="compact" />
                  </li>
                ))}
              </ul>
              {productsQuery.data.totalCount > productsQuery.data.items.length ? (
                <div className="flex justify-center pt-16">
                  <Link
                    href={buildBrandProductsHref(brand.name)}
                    className={cx(
                      buttonClassName({ variant: 'secondary', size: 'm', isFullWidth: true }),
                      'lg:w-240',
                    )}
                  >
                    전체 제품 보기
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </PageContainer>
      </section>
    </>
  );
}

// Figma 모바일 169 카드 2열(가로 12·세로 24), 데스크톱 240 카드 5열(가로 24·세로 40)
const PRODUCT_GRID_CLASS =
  'grid grid-cols-2 gap-x-12 gap-y-24 lg:grid-cols-5 lg:gap-x-24 lg:gap-y-40';

/**
 * 브랜드 히어로(Figma HF/BrandHero·HF/Web/BrandHero Detail, 통계 없음).
 * 이름·소개는 관리자 입력 텍스트라 텍스트 노드로만 그리고 줄바꿈만 살립니다.
 */
function BrandHero({
  brand,
  productTotalCount,
}: {
  brand: Brand;
  productTotalCount: number | undefined;
}) {
  const subline = getBrandSubline(brand);
  return (
    <section aria-labelledby="brand-name-heading" className="bg-text-1 text-inverse">
      {brand.coverImageUrl ? (
        <div className="h-220 lg:hidden">
          <BrandCover coverImageUrl={brand.coverImageUrl} />
        </div>
      ) : null}
      <PageContainer className="flex flex-col gap-20 pt-24 pb-32 lg:h-480 lg:flex-row lg:items-center lg:gap-24 lg:py-64">
        <div className="flex min-w-0 flex-col gap-20 lg:w-636 lg:shrink-0 lg:gap-32">
          <div className="flex h-48 w-120 items-center justify-center overflow-hidden rounded-8 bg-inverse lg:h-64 lg:w-160">
            <BrandLogo
              logoUrl={brand.logoUrl}
              brandName={brand.name}
              className="h-32 w-88 lg:h-40 lg:w-120"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-4 lg:gap-8">
            <h1
              id="brand-name-heading"
              className="text-h1 break-words text-inverse lg:line-clamp-2 lg:text-web-display-l"
            >
              {brand.name}
            </h1>
            {subline ? (
              <p className="text-label-s text-inverse-2 lg:text-label-m">{subline}</p>
            ) : null}
          </div>
          {brand.tagline ? (
            <p className="line-clamp-3 text-body-m whitespace-pre-line text-inverse-2 lg:line-clamp-2 lg:max-w-560 lg:text-web-body-xl">
              {brand.tagline}
            </p>
          ) : null}
          <BrandProductsCta brandName={brand.name} productTotalCount={productTotalCount} />
        </div>
        <div className="hidden h-352 min-w-0 flex-1 overflow-hidden rounded-12 lg:block">
          {brand.coverImageUrl ? (
            <BrandCover coverImageUrl={brand.coverImageUrl} />
          ) : (
            <BrandLogoPanel logoUrl={brand.logoUrl} brandName={brand.name} />
          )}
        </div>
      </PageContainer>
    </section>
  );
}

const CTA_CLASS =
  'inline-flex h-48 w-full items-center justify-center gap-8 rounded-capsule px-24 text-label-l whitespace-nowrap lg:w-fit';

/**
 * 「제품 00개 보기」. 숫자는 상품 목록 조회의 totalCount를 쓰고, 조회 중에는 숫자를 숨깁니다.
 * 상품이 0개면 이동할 곳이 없으므로 비활성으로 그립니다.
 */
function BrandProductsCta({
  brandName,
  productTotalCount,
}: {
  brandName: string;
  productTotalCount: number | undefined;
}) {
  if (productTotalCount === 0) {
    return (
      <span
        aria-disabled="true"
        className={cx(CTA_CLASS, 'cursor-not-allowed bg-pressed-dark text-text-disabled')}
      >
        제품 0개 보기
      </span>
    );
  }
  return (
    <Link
      href={buildBrandProductsHref(brandName)}
      className={cx(
        CTA_CLASS,
        'bg-inverse text-text-1 transition-colors hover:bg-surface',
        INVERSE_FOCUS_CLASS,
      )}
    >
      {productTotalCount === undefined ? '제품 보기' : `제품 ${productTotalCount}개 보기`}
      <Icon icon={ArrowRight} size={16} />
    </Link>
  );
}

/** 주력 분야·주요 인증·원산지 중 값이 있는 것만 */
function getBrandFacts(brand: Brand): { label: string; value: string }[] {
  const brandFacts = [
    { label: '주력 분야', value: brand.mainField },
    { label: '주요 인증', value: brand.certification },
    { label: '원산지', value: brand.originCountry },
  ];
  return brandFacts.filter((brandFact): brandFact is { label: string; value: string } =>
    Boolean(brandFact.value?.trim()),
  );
}

/** 브랜드 스토리와 사실 정보. 둘 다 없으면 영역을 그리지 않습니다. */
function BrandStory({ brand }: { brand: Brand }) {
  const brandFacts = getBrandFacts(brand);
  if (brand.story === null && brandFacts.length === 0) return null;
  return (
    <section aria-labelledby="brand-story-heading">
      <PageContainer className="flex flex-col gap-16 pt-48 lg:flex-row lg:gap-24 lg:pt-120">
        <div className="flex flex-col gap-16 lg:w-526 lg:shrink-0">
          {brand.story ? (
            <>
              <p className="text-label-s text-text-3">브랜드 스토리</p>
              <h2
                id="brand-story-heading"
                className="text-h2 whitespace-pre-line lg:line-clamp-3 lg:text-web-h2"
              >
                {brand.story.title}
              </h2>
            </>
          ) : (
            <h2 id="brand-story-heading" className="text-label-s text-text-3">
              브랜드 정보
            </h2>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-16 lg:gap-40">
          {brand.story ? <StoryBody body={brand.story.body} /> : null}
          {brandFacts.length > 0 ? (
            <dl className="flex flex-col pt-8 lg:grid lg:grid-cols-3 lg:gap-24 lg:pt-0">
              {brandFacts.map((brandFact) => (
                <div
                  key={brandFact.label}
                  className="flex border-b border-line py-12 lg:flex-col lg:gap-8 lg:border-t lg:border-b-0 lg:border-line-strong lg:pt-16 lg:pb-0"
                >
                  <dt className="w-88 shrink-0 text-body-s text-text-3 lg:w-auto lg:text-caption">
                    {brandFact.label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-body-s-medium break-words text-text-1 lg:text-title">
                    {brandFact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </PageContainer>
    </section>
  );
}

/**
 * 스토리 본문. 모바일은 여섯 줄까지 보여 준 뒤 「더 보기」로 펼치고, 데스크톱은 전체를 보여 줍니다.
 * 넘침 여부는 ResizeObserver로 재서, 짧은 본문에는 버튼을 그리지 않습니다.
 */
function StoryBody({ body }: { body: string }) {
  const bodyId = useId();
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const bodyElement = bodyRef.current;
    if (!bodyElement || typeof ResizeObserver === 'undefined') return;
    // observe 직후 한 번 호출되므로 첫 측정도 여기서 합니다.
    const resizeObserver = new ResizeObserver(() => {
      setIsOverflowing(bodyElement.scrollHeight > bodyElement.clientHeight + 1);
    });
    resizeObserver.observe(bodyElement);
    return () => resizeObserver.disconnect();
  }, [body]);

  return (
    <div className="flex flex-col gap-16">
      <p
        ref={bodyRef}
        id={bodyId}
        className={cx(
          'text-body-m whitespace-pre-line text-text-2 lg:line-clamp-none lg:max-w-720 lg:text-web-body-xl',
          !isExpanded && 'line-clamp-6',
        )}
      >
        {body}
      </p>
      {isOverflowing || isExpanded ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={bodyId}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="inline-flex h-44 w-fit items-center gap-4 text-label-m text-text-1 focus-ring lg:hidden"
        >
          {isExpanded ? '접기' : '더 보기'}
          <Icon icon={ChevronDown} size={16} className={isExpanded ? 'rotate-180' : undefined} />
        </button>
      ) : null}
    </div>
  );
}
