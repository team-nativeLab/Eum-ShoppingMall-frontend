'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { BrandSummary } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { PageContainer } from '@/components/page-container';
import { REDUCED_MOTION_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandLogo } from './brand-media';
import { BrandSpotlightBand } from './brand-spotlight-band';
import { useBrandsQuery } from './use-brands-query';

const BRAND_LOAD_ERROR_COPY_MAP = BRAND_LOAD_ERROR_COPY;
/** 선택 브랜드를 URL에 싣는 쿼리 키. 뒤로 가기와 새로고침에서 같은 브랜드를 복원합니다. */
const BRAND_QUERY_KEY = 'brand';

/**
 * 밴드가 화면 밖에 있을 때만 밴드 위치로 옮깁니다(사용자가 카드를 눌렀을 때만 호출).
 * 감속 모드를 켠 사용자에게는 부드러운 이동 대신 즉시 이동합니다.
 */
function scrollSpotlightIntoViewIfHidden(band: HTMLElement | null, prefersReducedMotion: boolean) {
  if (!band) return;
  const rect = band.getBoundingClientRect();
  const isOutsideViewport = rect.bottom <= 0 || rect.top >= window.innerHeight;
  if (!isOutsideViewport) return;
  band.scrollIntoView({ block: 'start', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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
          <>
            <div aria-hidden="true" className="h-508 animate-pulse bg-pressed-dark lg:h-400" />
            <PageContainer className="pt-24 lg:pt-48">
              <div aria-busy="true" className="grid grid-cols-2 gap-12 lg:grid-cols-5 lg:gap-24">
                {Array.from({ length: 10 }, (_, index) => (
                  <div
                    key={index}
                    className="h-200 animate-pulse rounded-12 border border-line bg-surface"
                  />
                ))}
              </div>
            </PageContainer>
          </>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const spotlightRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  // 선택은 URL의 brand가 정합니다. 없거나 목록에 없는 id(재조회 등)면 첫 브랜드를 씁니다. 동기화 effect 없이 파생합니다.
  const requestedBrandId = searchParams.get(BRAND_QUERY_KEY);
  const activeBrand = brands.find((brand) => brand.id === requestedBrandId) ?? brands[0];

  function handleSelectBrand(brandId: string) {
    // 히스토리 항목을 늘리지 않도록 replace로 갱신하고, 페이지 맨 위로 튀지 않게 scroll을 끕니다.
    router.replace(`/brands?${BRAND_QUERY_KEY}=${encodeURIComponent(brandId)}`, { scroll: false });
    scrollSpotlightIntoViewIfHidden(spotlightRef.current, prefersReducedMotion);
  }

  return (
    <>
      {activeBrand ? <BrandSpotlightBand brand={activeBrand} sectionRef={spotlightRef} /> : null}
      <PageContainer className="pt-24 lg:pt-48">
        <ul className="grid grid-cols-2 gap-12 lg:grid-cols-5 lg:gap-24">
          {brands.map((brand) => {
            const isSelected = brand.id === activeBrand?.id;
            return (
              <li key={brand.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${brand.name}, 제품 ${brand.productCount}개`}
                  onClick={() => handleSelectBrand(brand.id)}
                  className={cx(
                    'flex min-h-200 w-full flex-col overflow-hidden rounded-12 border-2 bg-bg text-left shadow-1 focus-ring transition-colors',
                    isSelected ? 'border-text-1' : 'border-line hover:border-text-accent-black',
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
                      <span className="text-label-m text-text-accent-black">{brand.name}</span>
                    )}
                  </span>
                  <span className="flex min-h-52 w-full items-center justify-between gap-8 px-12 py-8">
                    <span
                      className={cx(
                        'min-w-0 truncate text-label-m',
                        isSelected ? 'font-bold' : undefined,
                      )}
                    >
                      {brand.name}
                    </span>
                    <span className="shrink-0 text-label-s text-text-3">
                      {brand.productCount.toLocaleString('ko-KR')}개
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PageContainer>
    </>
  );
}
