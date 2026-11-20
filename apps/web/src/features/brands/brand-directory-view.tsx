'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { getPriceDisplay } from '@eum/api/price';
import type { BrandSummary, Product } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, Store } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageContainer } from '@/components/page-container';
import { buildBrandHref } from '@/features/products/product-navigation';
import { ProductImage } from '@/features/products/product-image';
import { useProductsQuery } from '@/features/products/use-products-query';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandLogo } from './brand-media';
import { useBrandQuery } from './use-brand-query';
import { useBrandsQuery } from './use-brands-query';

const BRAND_LOAD_ERROR_COPY_MAP = BRAND_LOAD_ERROR_COPY;
const DEFAULT_BRAND_ACCENT_COLOR = '#2F6F62';
const BRAND_ACCENT_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

function getBrandAccentColor(color: string | undefined): string {
  return color && BRAND_ACCENT_COLOR_PATTERN.test(color) ? color : DEFAULT_BRAND_ACCENT_COLOR;
}

function getAccentForeground(
  color: string,
): 'text-text-1' | 'text-inverse' | 'text-text-accent-black' {
  const matches = color.slice(1).match(/.{2}/g);
  if (!matches || matches.length !== 3) return 'text-inverse';
  const channels = matches.map((channel) => Number.parseInt(channel, 16) / 255);
  const luminance = channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
  const contrastWithText = (foregroundLuminance: number) =>
    (Math.max(luminance, foregroundLuminance) + 0.05) /
    (Math.min(luminance, foregroundLuminance) + 0.05);
  if (contrastWithText(0.005605391624202723) >= 4.5) return 'text-text-1';
  if (contrastWithText(1) >= 4.5) return 'text-inverse';
  return 'text-text-accent-black';
}

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
          <PageContainer className="pt-16 lg:pt-24">
            <div aria-busy="true" className="grid grid-cols-2 gap-12 lg:grid-cols-5 lg:gap-24">
              {Array.from({ length: 10 }, (_, index) => (
                <div
                  key={index}
                  className="h-200 animate-pulse rounded-12 border border-line bg-surface"
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
          <BrandCardDirectory brands={brandsQuery.data} />
        )}
      </section>
    </>
  );
}

function BrandDirectoryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const failureKind = getApiFailureKind(error);
  const errorCopy = BRAND_LOAD_ERROR_COPY_MAP[failureKind];
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

function BrandCardDirectory({ brands }: { brands: BrandSummary[] }) {
  const [activeBrandId, setActiveBrandId] = useState(brands[0]?.id ?? '');
  const activeBrand = brands.find((brand) => brand.id === activeBrandId) ?? brands[0];

  return (
    <PageContainer>
      <div className="group/brand-directory relative">
        <ul className="grid grid-cols-2 gap-12 lg:grid-cols-5 lg:gap-24">
          {brands.map((brand) => (
            <li key={brand.id}>
              <BrandCard
                brand={brand}
                isSelected={brand.id === activeBrand?.id}
                onSelect={() => setActiveBrandId(brand.id)}
              />
            </li>
          ))}
        </ul>
        {activeBrand ? <BrandSelectionPanel brand={activeBrand} /> : null}
      </div>
    </PageContainer>
  );
}

function BrandCard({
  brand,
  isSelected,
  onSelect,
}: {
  brand: BrandSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={isSelected}
      aria-controls="brand-selection-panel"
      onClick={onSelect}
      style={isSelected ? { borderColor: getBrandAccentColor(brand.accentColor) } : undefined}
      className={cx(
        'flex min-h-200 w-full flex-col overflow-hidden rounded-12 border bg-bg text-left shadow-1 focus-ring transition-colors',
        isSelected ? 'border-2' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="flex h-148 w-full items-center justify-center overflow-hidden border-b border-line px-16 py-12">
        {brand.logoUrl ? (
          <BrandLogo
            logoUrl={brand.logoUrl}
            brandName={brand.name}
            className="size-full"
            settings={brand.logoSettings}
          />
        ) : (
          <span className="text-label-m text-text-2">{brand.name}</span>
        )}
      </span>
      <span className="flex min-h-52 w-full items-center justify-between gap-8 px-12 py-8">
        <span className="min-w-0 truncate text-label-m">{brand.name}</span>
        <span className="shrink-0 text-label-s text-text-3">
          {brand.productCount.toLocaleString('ko-KR')}개
        </span>
      </span>
    </button>
  );
}

function BrandSelectionPanel({ brand }: { brand: BrandSummary }) {
  const brandQuery = useBrandQuery(brand.id);
  const productsQuery = useProductsQuery(
    { brand: [brand.name], pageSize: 3, sortBy: 'recommended' },
    { enabled: brand.productCount > 0 },
  );
  const detail = brandQuery.data;
  const accentColor = getBrandAccentColor(brand.accentColor);
  const accentForeground = getAccentForeground(accentColor);

  return (
    <aside
      id="brand-selection-panel"
      aria-labelledby="brand-selection-title"
      className="mt-16 overflow-hidden rounded-24 border border-line bg-bg shadow-3 lg:absolute lg:top-160 lg:left-0 lg:mt-0 lg:w-560 lg:group-focus-within/brand-directory:static"
    >
      <div
        className={cx('px-20 py-20 lg:px-32 lg:py-24', accentForeground)}
        style={{
          backgroundColor: accentColor,
          ...(accentForeground === 'text-text-accent-black'
            ? { color: 'var(--color-text-accent-black)' }
            : {}),
        }}
      >
        <p className="text-label-m">{brand.englishName ?? brand.name}</p>
        <h3 id="brand-selection-title" className="mt-4 text-h3">
          {brand.name}
        </h3>
        {brand.tagline ? <p className="mt-8 text-body-s">{brand.tagline}</p> : null}
      </div>
      <div className="grid gap-16 p-16 lg:p-24">
        {brandQuery.isPending ? (
          <p className="text-body-s text-text-3" aria-live="polite">
            브랜드 정보를 불러오는 중입니다.
          </p>
        ) : null}
        {brandQuery.isError ? (
          <div className="flex items-center justify-between gap-8 text-body-s text-text-3">
            <span>브랜드 정보를 불러오지 못했습니다.</span>
            <button
              type="button"
              onClick={() => void brandQuery.refetch()}
              className="min-h-32 rounded-4 px-8 text-label-s underline focus-ring"
            >
              다시 시도
            </button>
          </div>
        ) : null}
        {detail?.mainField || detail?.certification ? (
          <div className="flex flex-wrap gap-8">
            {[detail.mainField, detail.certification]
              .filter((field): field is string => Boolean(field?.trim()))
              .map((field) => (
                <span
                  key={field}
                  className="rounded-capsule border border-line bg-surface px-12 py-6 text-label-s text-text-2"
                >
                  {field}
                </span>
              ))}
          </div>
        ) : null}
        <section aria-labelledby="brand-recommendations-title">
          <h4 id="brand-recommendations-title" className="text-label-m text-text-3">
            추천 상품
          </h4>
          {productsQuery.isPending && brand.productCount > 0 ? (
            <p className="mt-12 text-body-s text-text-3" aria-live="polite">
              상품을 불러오는 중입니다.
            </p>
          ) : productsQuery.isError ? (
            <div className="mt-12 flex items-center justify-between gap-8 text-body-s text-text-3">
              <span>추천 상품을 불러오지 못했습니다.</span>
              <button
                type="button"
                onClick={() => void productsQuery.refetch()}
                className="min-h-32 rounded-4 px-8 text-label-s underline focus-ring"
              >
                다시 시도
              </button>
            </div>
          ) : productsQuery.data?.items.length ? (
            <ul className="mt-8 divide-y divide-line">
              {productsQuery.data.items.map((product) => (
                <li key={product.id}>
                  <RecommendedProduct product={product} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-body-s text-text-3">등록된 추천 상품이 없습니다.</p>
          )}
        </section>
        <Link
          href={buildBrandHref(brand.id)}
          className={cx(
            'flex min-h-48 items-center justify-center gap-8 rounded-8 px-16 text-label-l focus-ring',
            accentForeground,
          )}
          style={{ backgroundColor: accentColor }}
        >
          {brand.name} 브랜드관 바로가기
          <Icon icon={ArrowRight} size={20} />
        </Link>
      </div>
    </aside>
  );
}

function RecommendedProduct({ product }: { product: Product }) {
  const priceDisplay = getPriceDisplay(product);
  return (
    <Link
      href={`/products/${encodeURIComponent(product.id)}`}
      className="flex min-h-76 items-center gap-12 py-8 focus-ring"
    >
      <span className="size-56 shrink-0 overflow-hidden rounded-8 border border-line bg-surface">
        <ProductImage src={product.thumbnailUrl} alt="" />
      </span>
      <span className="min-w-0 flex-1 truncate text-body-s">{product.name}</span>
      <span className="shrink-0 text-label-s text-danger">{priceDisplay.text}</span>
    </Link>
  );
}
