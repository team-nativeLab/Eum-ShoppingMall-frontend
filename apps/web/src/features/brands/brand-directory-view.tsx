'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { BrandSummary } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PageContainer } from '@/components/page-container';
import { buildBrandProductsHref } from '@/features/products/product-navigation';
import {
  DESKTOP_QUERY,
  getScrollBehavior,
  REDUCED_MOTION_QUERY,
  useMediaQuery,
} from '@/lib/use-media-query';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandLogo } from './brand-media';
import { BrandSpotlightBand, SPOTLIGHT_HEADER_OFFSET_PX } from './brand-spotlight-band';
import { useBrandsQuery } from './use-brands-query';

/** 선택 브랜드를 URL에 싣는 쿼리 키. 뒤로 가기와 새로고침에서 같은 브랜드를 복원합니다. */
const BRAND_QUERY_KEY = 'brand';

/**
 * 밴드 상단이 sticky 헤더 뒤에 가려지거나(헤더 높이보다 위) 화면 아래에 있으면 밴드 위치로 옮깁니다.
 * 충분히 보이는 밴드는 옮기지 않습니다. 감속 모드를 켠 사용자에게는 부드러운 이동 대신 즉시 이동합니다.
 */
function scrollSpotlightIntoViewIfHidden(
  band: HTMLElement | null,
  headerOffsetPx: number,
  prefersReducedMotion: boolean,
) {
  if (!band) return;
  const { top } = band.getBoundingClientRect();
  const isCoveredByHeader = top < headerOffsetPx;
  const isBelowViewport = top > window.innerHeight;
  if (!isCoveredByHeader && !isBelowViewport) return;
  band.scrollIntoView({ block: 'start', behavior: getScrollBehavior(prefersReducedMotion) });
}

/**
 * 브랜드 목록 화면입니다. 선택 브랜드는 URL의 brand 쿼리가 정합니다.
 * 목록에 없는 id(잘못된 주소, 재조회로 사라진 브랜드)면 선택 없이 목록만 보여 줍니다.
 */
export function BrandDirectoryView() {
  const brandsQuery = useBrandsQuery();
  const searchParams = useSearchParams();
  const requestedBrandId = searchParams.get(BRAND_QUERY_KEY);
  const activeBrand = brandsQuery.data?.find((brand) => brand.id === requestedBrandId);
  // 제목 블록은 해석된 선택 브랜드가 있을 때, 또는 요청된 브랜드를 확인하는 중일 때 숨깁니다.
  // 목록이 도착해 브랜드를 찾지 못하면(또는 목록 조회가 실패하면) 제목 블록이 다시 보입니다.
  const isTitleHidden =
    activeBrand !== undefined || (requestedBrandId !== null && brandsQuery.isPending);

  return (
    <>
      {isTitleHidden ? (
        // 히어로 밴드가 헤더 바로 아래 첫 요소가 되도록 제목 블록은 화면에서 숨기고, 페이지 제목만 남깁니다.
        <h1 className="sr-only">브랜드</h1>
      ) : (
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
      )}
      <section aria-labelledby="brand-directory-heading" className="pb-32 lg:pb-56">
        <h2 id="brand-directory-heading" className="sr-only">
          전체 브랜드
        </h2>
        {brandsQuery.isPending ? (
          <>
            {/* 요청된 브랜드가 있으면 밴드가 들어갈 자리를 미리 비워 두어, 도착할 때 본문이 밀리지 않게 합니다. */}
            {requestedBrandId !== null ? (
              <div aria-hidden="true" className="h-508 animate-pulse bg-pressed-dark lg:h-400" />
            ) : null}
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
          <BrandCardDirectory
            brands={brandsQuery.data}
            activeBrand={activeBrand}
            requestedBrandId={requestedBrandId}
          />
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
 * 선택 밴드(선택이 있을 때만)와 브랜드 카드 그리드입니다.
 * activeBrand는 목록에서 찾은 선택 브랜드이고, 없으면 밴드를 그리지 않습니다.
 */
function BrandCardDirectory({
  brands,
  activeBrand,
  requestedBrandId,
}: {
  brands: BrandSummary[];
  activeBrand: BrandSummary | undefined;
  requestedBrandId: string | null;
}) {
  const router = useRouter();
  const spotlightRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const headerOffsetPx = isDesktop
    ? SPOTLIGHT_HEADER_OFFSET_PX.desktop
    : SPOTLIGHT_HEADER_OFFSET_PX.mobile;
  const activeBrandId = activeBrand?.id;
  // 사용자가 마지막으로 고른 카드의 id입니다(스크롤 예약). 여러 번 빠르게 골라도 마지막 선택이 남습니다.
  // 첫 로드의 ?brand=처럼 사용자가 고르지 않은 선택에는 예약이 없으므로 스크롤하지 않습니다.
  const pendingScrollBrandIdRef = useRef<string | null>(null);

  // 예약은 URL의 brand가 그 id와 같아졌을 때 한 번만 쓰고 비웁니다.
  // URL이 아직 다른 카드를 가리키면 예약을 유지하고(이전 클릭의 반영 전), 목록에서 사라진 id는 확정적으로 무효이므로 버립니다.
  // headerOffsetPx나 감속 모드가 바뀌어 effect가 다시 돌아도, 맞지 않는 예약은 지우지 않습니다.
  useEffect(() => {
    const pendingBrandId = pendingScrollBrandIdRef.current;
    if (pendingBrandId === null) return;
    if (!brands.some((brand) => brand.id === pendingBrandId)) {
      pendingScrollBrandIdRef.current = null;
      return;
    }
    if (pendingBrandId !== requestedBrandId) return;
    pendingScrollBrandIdRef.current = null;
    scrollSpotlightIntoViewIfHidden(spotlightRef.current, headerOffsetPx, prefersReducedMotion);
  }, [brands, requestedBrandId, headerOffsetPx, prefersReducedMotion]);

  function handleSelectBrand(brandId: string) {
    // 마지막 클릭이 지금 표시된 카드면 스크롤할 이유가 없으므로 남은 예약을 비웁니다(같은 카드 재클릭 무스크롤).
    // 그 밖의 클릭은 예약을 덮어써, 마지막으로 고른 카드가 기준이 되게 합니다.
    pendingScrollBrandIdRef.current = brandId === activeBrandId ? null : brandId;
    // 히스토리 항목을 늘리지 않도록 replace로 갱신하고, 페이지 맨 위로 튀지 않게 scroll을 끕니다.
    router.replace(`/brands?${BRAND_QUERY_KEY}=${encodeURIComponent(brandId)}`, { scroll: false });
  }

  return (
    <>
      {activeBrand ? <BrandSpotlightBand brand={activeBrand} sectionRef={spotlightRef} /> : null}
      <PageContainer className="pt-24 lg:pt-48">
        <ul className="grid grid-cols-2 gap-12 lg:grid-cols-6 lg:gap-24">
          {brands.map((brand) => (
            <li key={brand.id} className="min-w-0">
              <BrandTile
                brand={brand}
                isSelected={brand.id === activeBrandId}
                onSelect={() => handleSelectBrand(brand.id)}
              />
            </li>
          ))}
        </ul>
      </PageContainer>
    </>
  );
}

/**
 * 브랜드 타일. 본문 button(선택)과 화살표 Link(제품 목록)는 형제 요소입니다.
 * 링크를 button 안에 넣으면 중첩 인터랙티브가 되므로, 링크는 본문 위에 절대 위치로 겹쳐 둡니다.
 * Tab 순서: 타일 본문 → 같은 타일의 화살표 링크 → 다음 타일.
 */
function BrandTile({
  brand,
  isSelected,
  onSelect,
}: {
  brand: BrandSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`${brand.name}, 제품 ${brand.productCount}개`}
        onClick={onSelect}
        className={cx(
          // 로고 줄(48) + 간격(12) + 이름 최대 두 줄 + 개수 줄이 본문 높이(128)에 맞도록 간격을 줄였습니다.
          'flex h-164 w-full flex-col gap-12 overflow-hidden rounded-8 border-2 bg-bg p-16 text-left shadow-1 focus-ring transition-colors',
          isSelected ? 'border-text-1' : 'border-line hover:border-text-accent-black',
        )}
      >
        <span className="flex h-48 w-full items-center justify-center">
          <span className="flex h-48 w-full max-w-120 items-center justify-center overflow-hidden rounded-4 bg-surface">
            <BrandLogo
              logoUrl={brand.logoUrl}
              brandName={brand.name}
              className="size-full"
              settings={brand.logoSettings}
            />
          </span>
        </span>
        <span className="flex w-full min-w-0 flex-col gap-4">
          {/* 이름은 카드 폭 전체를 쓰고 두 줄까지 보입니다. 화살표는 아래 「제품 N개」 줄 오른쪽에 둬 이름 폭을 줄이지 않습니다. */}
          <span
            className={cx(
              'line-clamp-2 text-title break-words text-text-1',
              isSelected ? 'font-bold' : undefined,
            )}
          >
            {brand.name}
          </span>
          <span className="text-caption text-text-3">
            제품 {brand.productCount.toLocaleString('ko-KR')}개
          </span>
        </span>
      </button>
      {/* 「제품 N개」 줄 오른쪽 끝에 맞춘 위치입니다. 타일 본문 선택과 별개로 제품 목록으로 갑니다. */}
      <Link
        href={buildBrandProductsHref(brand.id)}
        aria-label={`${brand.name} 제품 보기`}
        className="absolute right-18 bottom-14 inline-flex size-24 items-center justify-center rounded-capsule text-text-1 focus-ring hover:bg-surface"
      >
        <Icon icon={ArrowRight} size={16} />
      </Link>
    </div>
  );
}
