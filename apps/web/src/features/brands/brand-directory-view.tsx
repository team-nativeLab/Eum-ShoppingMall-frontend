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
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageContainer } from '@/components/page-container';
import {
  DESKTOP_QUERY,
  getScrollBehavior,
  REDUCED_MOTION_QUERY,
  useMediaQuery,
} from '@/lib/use-media-query';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandLogo } from './brand-media';
import {
  BRAND_PRODUCTS_SECTION_HREF,
  type BrandProductsOpenRequest,
  BrandProductsSection,
} from './brand-products-section';
import { BRAND_HEADER_OFFSET_PX } from './brand-scroll';
import { BrandSpotlightBand } from './brand-spotlight-band';
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
 * URL 해시가 상품 섹션(#brand-products)이면 그 브랜드의 섹션을 열린 상태로 돌려줍니다. 해시가 없으면 닫힌 상태(null)입니다.
 * 이 경로로 열면 포커스는 옮기지 않습니다. 스크롤은 scrollOnOpen이 true일 때만 요청합니다(새로고침에서만 true).
 */
function readBrandProductsOpenFromLocation(scrollOnOpen: boolean): BrandProductsOpenRequest | null {
  if (window.location.hash !== BRAND_PRODUCTS_SECTION_HREF) return null;
  const brandId = new URLSearchParams(window.location.search).get(BRAND_QUERY_KEY);
  return brandId === null ? null : { brandId, shouldFocus: false, shouldScroll: scrollOnOpen };
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
 * 선택 밴드, 선택 브랜드의 상품 섹션(「제품 보기」로 연 경우에만, 상품이 있을 때만), 브랜드 카드 그리드입니다.
 * activeBrand는 목록에서 찾은 선택 브랜드이고, 없으면 밴드와 상품 섹션을 그리지 않습니다.
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
  const headerOffsetPx = isDesktop ? BRAND_HEADER_OFFSET_PX.desktop : BRAND_HEADER_OFFSET_PX.mobile;
  const activeBrandId = activeBrand?.id;
  // 사용자가 마지막으로 고른 카드의 id입니다(스크롤 예약). 여러 번 빠르게 골라도 마지막 선택이 남습니다.
  // 첫 로드의 ?brand=처럼 사용자가 고르지 않은 선택에는 예약이 없으므로 스크롤하지 않습니다.
  const pendingScrollBrandIdRef = useRef<string | null>(null);
  // 「제품 보기」로 연 상품 섹션의 요청입니다. 해시(#brand-products)와 맞춰 둡니다.
  // 클릭은 이 상태를 바로 바꾸고, 새로고침은 마운트 때 해시를 읽으며, 뒤로·앞으로 가기는 아래 popstate에서 다시 맞춥니다.
  const [productsOpenRequest, setProductsOpenRequest] = useState<BrandProductsOpenRequest | null>(
    () => {
      const requestFromHash = readBrandProductsOpenFromLocation(false);
      // 새로고침으로 바로 열리는 섹션만 스크롤합니다. 상품이 없거나 다른 브랜드의 해시면 섹션이 열리지 않으므로 스크롤 요청도 만들지 않습니다.
      const opensNow =
        requestFromHash !== null &&
        activeBrand !== undefined &&
        activeBrand.id === requestFromHash.brandId &&
        activeBrand.productCount > 0;
      return opensNow ? { ...requestFromHash, shouldScroll: true } : requestFromHash;
    },
  );

  // 뒤로·앞으로 가기는 해시를 URL 그대로 되돌리므로, 상품 섹션 상태를 URL 해시에 다시 맞춥니다. 스크롤은 하지 않습니다.
  useEffect(() => {
    function handlePopState() {
      setProductsOpenRequest(readBrandProductsOpenFromLocation(false));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 스크롤·포커스 요청을 처리한 뒤 두 플래그를 false로 되돌립니다. 같은 브랜드의 요청일 때만 바꿉니다.
  const handleBrandProductsOpenRequestHandled = useCallback((brandId: string) => {
    setProductsOpenRequest((current) =>
      current !== null &&
      current.brandId === brandId &&
      (current.shouldFocus || current.shouldScroll)
        ? { brandId, shouldFocus: false, shouldScroll: false }
        : current,
    );
  }, []);

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
    // 카드를 누르면 다른 카드든 이미 고른 카드든 상품 섹션을 닫습니다(같은 카드 재클릭도 닫힘).
    // 아래 replace가 해시도 떼므로 상태와 URL이 함께 닫힙니다. 선택 표시는 replace가 정합니다.
    setProductsOpenRequest(null);
    // 히스토리 항목을 늘리지 않도록 replace로 갱신하고, 페이지 맨 위로 튀지 않게 scroll을 끕니다.
    router.replace(`/brands?${BRAND_QUERY_KEY}=${encodeURIComponent(brandId)}`, { scroll: false });
  }

  function handleOpenBrandProducts(brandId: string) {
    // 「제품 보기」 링크가 해시 이동으로 뒤로 가기 기록을 남깁니다. 섹션은 이 상태로 열고, 스크롤과 포커스는 섹션이 마운트된 뒤 옮깁니다.
    // 이미 열린 섹션을 다시 누르면 새 객체가 되어 같은 처리가 다시 돕니다.
    setProductsOpenRequest({ brandId, shouldFocus: true, shouldScroll: true });
  }

  // 상품 섹션은 선택 브랜드가 상품을 가지고 있고, 그 브랜드에 대해 「제품 보기」로 열렸을 때만 그립니다.
  const openedProductsRequest =
    activeBrand !== undefined &&
    activeBrand.productCount > 0 &&
    productsOpenRequest !== null &&
    productsOpenRequest.brandId === activeBrand.id
      ? productsOpenRequest
      : null;

  return (
    <>
      {activeBrand ? (
        <BrandSpotlightBand
          brand={activeBrand}
          sectionRef={spotlightRef}
          onOpenProducts={() => handleOpenBrandProducts(activeBrand.id)}
        />
      ) : null}
      {activeBrand && openedProductsRequest ? (
        // key로 브랜드마다 새로 마운트해, 이전 브랜드의 목록 상태(로딩·포커스 요청)가 남지 않게 합니다.
        <BrandProductsSection
          key={activeBrand.id}
          brand={activeBrand}
          openRequest={openedProductsRequest}
          onOpenRequestHandled={handleBrandProductsOpenRequestHandled}
        />
      ) : null}
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
 * 브랜드 타일. 타일 전체가 하나의 button이며, 누르면 URL의 brand 쿼리로 선택 브랜드가 바뀝니다.
 * 제품 목록으로 가는 링크는 두지 않습니다(선택 밴드의 「제품 보기」와 상품 섹션이 맡습니다).
 * Tab 순서: 타일 하나가 정지점 하나입니다.
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
        {/* 이름은 카드 폭 전체를 쓰고 두 줄까지 보입니다. */}
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
  );
}
