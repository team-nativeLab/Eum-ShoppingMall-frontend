'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { Brand, BrandSummary } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, ChevronRight, Store } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { PageContainer } from '@/components/page-container';
import { buildBrandHref } from '@/features/products/product-navigation';
import {
  DESKTOP_QUERY,
  getScrollBehavior,
  useMediaQuery,
  usePrefersReducedMotion,
} from '@/lib/use-media-query';
import { groupBrandsByIndex, type BrandIndexGroup } from './brand-index';
import { BRAND_LOAD_ERROR_COPY } from './brand-load-error';
import { BrandCover, BrandLogo, BrandLogoPanel, getBrandSubline } from './brand-media';
import { useBrandsQuery } from './use-brands-query';
import { useFeaturedBrandQuery } from './use-featured-brand-query';

/** 「더 보기」 한 번에 펼치는 브랜드 수. Figma에 기준이 없어 데스크톱 6열 × 4줄, 모바일 12행으로 둡니다. */
export const BRAND_PAGE_SIZE = { desktop: 24, mobile: 12 } as const;

/** 「전체」 색인 키 id. 디렉터리 맨 위로 이동합니다. */
const ALL_INDEX_KEY = 'all';
const DIRECTORY_LIST_ID = 'brand-directory-list';

// 다크 밴드 위 포커스 표시(공통 focus-ring은 검은 외곽선이라 보이지 않음, home-view QuoteBanner와 같은 방식)
const INVERSE_FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse';

/**
 * W-32 브랜드 목록. 이달의 브랜드(다크 밴드) + 초성/A–Z 색인 + 브랜드 디렉터리로 구성합니다.
 * 이달의 브랜드와 디렉터리는 따로 조회해서, 한쪽이 실패해도 다른 쪽은 그대로 보여 줍니다.
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
              <p className="text-label-s text-text-3">
                <span className="hidden lg:inline">브랜드 </span>
                {brandsQuery.data.length}개
              </p>
            ) : null}
          </div>
          <p className="text-body-s text-text-2 lg:text-web-body-xl">
            현장에서 검증한 안전용품 브랜드를 한곳에 모았습니다.
          </p>
        </div>
      </PageContainer>
      <FeaturedBrandBand />
      <section aria-labelledby="brand-directory-heading" className="pb-16 lg:pb-56">
        <h2 id="brand-directory-heading" className="sr-only">
          전체 브랜드
        </h2>
        {brandsQuery.isPending ? (
          <PageContainer aria-busy="true" className="pt-16 lg:pt-64">
            <div className="h-36 animate-pulse rounded-capsule bg-surface lg:h-40" />
            <div className="mt-32 grid gap-12 lg:mt-48 lg:grid-cols-6 lg:gap-24">
              {Array.from({ length: 6 }, (_, skeletonIndex) => (
                <div
                  key={skeletonIndex}
                  className="h-72 animate-pulse rounded-8 bg-surface lg:h-164"
                />
              ))}
            </div>
          </PageContainer>
        ) : brandsQuery.isError ? (
          <PageContainer className="pt-16 lg:pt-64">
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
          <BrandDirectory brands={brandsQuery.data} />
        )}
      </section>
    </>
  );
}

/** 디렉터리 조회 실패 안내. 다시 시도해도 해결되지 않는 오류에는 버튼을 보여 주지 않습니다. */
function BrandDirectoryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const failureKind = getApiFailureKind(error);
  const errorCopy = BRAND_LOAD_ERROR_COPY[failureKind];
  return (
    <NoticeInline tone="danger" role="alert">
      {errorCopy.title}. {errorCopy.description}
      {failureKind === 'temporary' ? (
        <Button variant="secondary" size="s" className="mt-8" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </NoticeInline>
  );
}

/**
 * 이달의 브랜드(Figma HF/BrandHero Spotlight). 지정한 브랜드가 없거나(null) 조회에 실패하면 밴드를 숨깁니다.
 * 모바일은 밴드 전체가 링크, 데스크톱은 「브랜드관 보기」 버튼이 링크입니다.
 */
function FeaturedBrandBand() {
  const featuredQuery = useFeaturedBrandQuery();
  if (featuredQuery.isPending) {
    return <div aria-busy="true" className="h-112 animate-pulse bg-surface lg:h-400" />;
  }
  if (featuredQuery.isError || featuredQuery.data === null) return null;
  return <FeaturedBrandContent brand={featuredQuery.data} />;
}

function FeaturedBrandContent({ brand }: { brand: Brand }) {
  const brandHref = buildBrandHref(brand.id);
  const subline = getBrandSubline(brand);
  return (
    <section aria-label="이달의 브랜드" className="bg-text-1 text-inverse">
      <Link
        href={brandHref}
        // 밴드가 화면 폭 전체라 바깥 외곽선이 흰 배경에 묻히므로 안쪽(-4)에 그립니다.
        className="flex items-center gap-16 px-20 py-24 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-inverse lg:hidden"
      >
        <span className="flex size-64 shrink-0 items-center justify-center overflow-hidden rounded-8 bg-inverse">
          <BrandLogo logoUrl={brand.logoUrl} brandName={brand.name} className="size-48" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="text-label-s text-inverse-2">이달의 브랜드</span>
          <span className="line-clamp-2 text-h3 break-words text-inverse">{brand.name}</span>
          {brand.tagline ? (
            <span className="line-clamp-2 text-body-s break-words text-inverse-2">
              {brand.tagline}
            </span>
          ) : null}
        </span>
        <Icon icon={ChevronRight} size={24} className="shrink-0" />
      </Link>
      <PageContainer className="hidden h-400 items-center gap-24 py-48 lg:flex">
        <div className="flex w-636 shrink-0 flex-col justify-center gap-24">
          <p className="text-label-s text-inverse-2">이달의 브랜드</p>
          <div className="flex h-64 w-160 items-center justify-center overflow-hidden rounded-8 bg-inverse">
            <BrandLogo logoUrl={brand.logoUrl} brandName={brand.name} className="h-40 w-120" />
          </div>
          <div className="flex min-w-0 flex-col gap-8">
            <h2 className="line-clamp-2 text-web-h2 break-words text-inverse">{brand.name}</h2>
            {subline ? (
              <p className="line-clamp-2 text-label-m break-words text-inverse-2">{subline}</p>
            ) : null}
          </div>
          {brand.tagline ? (
            <p className="line-clamp-2 max-w-560 text-web-body-xl break-words whitespace-pre-line text-inverse-2">
              {brand.tagline}
            </p>
          ) : null}
          <Link
            href={brandHref}
            className={cx(
              'inline-flex h-48 w-fit items-center gap-8 rounded-capsule bg-inverse px-24 text-label-l text-text-1 transition-colors hover:bg-surface',
              INVERSE_FOCUS_CLASS,
            )}
          >
            브랜드관 보기
            <Icon icon={ArrowRight} size={16} />
          </Link>
        </div>
        <div className="h-304 min-w-0 flex-1 overflow-hidden rounded-12">
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

/** 색인 묶음 + 디렉터리 안에서의 시작 위치(펼침 개수 계산용) */
interface PositionedBrandGroup extends BrandIndexGroup<BrandSummary> {
  startPosition: number;
}

/** 브랜드가 있는 묶음만 남기고, 디렉터리 전체 순서에서 각 묶음이 시작하는 위치를 붙이는 함수 */
function positionBrandGroups(
  indexGroups: readonly BrandIndexGroup<BrandSummary>[],
): PositionedBrandGroup[] {
  const positionedGroups: PositionedBrandGroup[] = [];
  let nextStartPosition = 0;
  for (const indexGroup of indexGroups) {
    if (indexGroup.brands.length === 0) continue;
    positionedGroups.push({ ...indexGroup, startPosition: nextStartPosition });
    nextStartPosition += indexGroup.brands.length;
  }
  return positionedGroups;
}

/**
 * 색인 + 브랜드 디렉터리. 전체 목록을 한 번에 받아 화면에서 N개씩 펼칩니다(Pagination 없음).
 * 색인 키를 누르면 그 묶음 끝까지 펼친 뒤 묶음 제목으로 이동하고 포커스를 옮깁니다.
 */
function BrandDirectory({ brands }: { brands: BrandSummary[] }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const prefersReducedMotion = usePrefersReducedMotion();
  const pageSize = isDesktop ? BRAND_PAGE_SIZE.desktop : BRAND_PAGE_SIZE.mobile;
  // 사용자가 펼친 개수. 아직 펼치지 않았으면 null(기본 한 페이지)
  const [requestedCount, setRequestedCount] = useState<number | null>(null);
  const [activeIndexKey, setActiveIndexKey] = useState<string>(ALL_INDEX_KEY);
  const directoryListRef = useRef<HTMLDivElement>(null);

  const indexGroups = useMemo(() => groupBrandsByIndex(brands), [brands]);
  const positionedGroups = useMemo(() => positionBrandGroups(indexGroups), [indexGroups]);
  const totalCount = brands.length;
  const visibleCount = Math.min(totalCount, Math.max(requestedCount ?? 0, pageSize));

  // 키보드·화면 낭독기 사용자도 이동한 곳을 알 수 있도록 대상에 포커스를 옮깁니다.
  const moveTo = (targetElement: HTMLElement | null) => {
    if (!targetElement) return;
    targetElement.scrollIntoView({
      behavior: getScrollBehavior(prefersReducedMotion),
      block: 'start',
    });
    targetElement.focus({ preventScroll: true });
  };

  const handleIndexClick = (
    clickEvent: MouseEvent<HTMLAnchorElement>,
    indexGroup: PositionedBrandGroup | null,
  ) => {
    clickEvent.preventDefault();
    if (indexGroup === null) {
      setActiveIndexKey(ALL_INDEX_KEY);
      moveTo(directoryListRef.current);
      return;
    }
    const groupEndCount = indexGroup.startPosition + indexGroup.brands.length;
    // 묶음이 모두 그려진 뒤 이동해야 하므로 상태 반영을 동기로 끝냅니다.
    flushSync(() => {
      setActiveIndexKey(indexGroup.anchorId);
      setRequestedCount((currentCount) => Math.max(currentCount ?? 0, pageSize, groupEndCount));
    });
    moveTo(document.getElementById(`${indexGroup.anchorId}-heading`));
  };

  const handleShowMore = () => {
    const firstNewPosition = visibleCount;
    flushSync(() => setRequestedCount(visibleCount + pageSize));
    // 새로 펼친 첫 브랜드로 포커스를 옮겨, 버튼이 사라져도 포커스를 잃지 않게 합니다.
    directoryListRef.current
      ?.querySelector<HTMLElement>(`[data-brand-position="${firstNewPosition}"]`)
      ?.focus();
  };

  return (
    <>
      <div className="border-b border-line">
        <PageContainer className="pt-16 pb-12 lg:pt-64 lg:pb-24">
          <nav aria-label="브랜드 색인">
            <ul className="-mx-20 flex gap-8 overflow-x-auto px-20 py-4 lg:mx-0 lg:flex-wrap lg:gap-4 lg:overflow-visible lg:px-0 lg:py-0">
              <li className="shrink-0">
                <IndexKeyLink
                  href={`#${DIRECTORY_LIST_ID}`}
                  label="전체"
                  isWide
                  isActive={activeIndexKey === ALL_INDEX_KEY}
                  onClick={(clickEvent) => handleIndexClick(clickEvent, null)}
                />
              </li>
              {indexGroups.map((indexGroup) => {
                const positionedGroup = positionedGroups.find(
                  (candidateGroup) => candidateGroup.anchorId === indexGroup.anchorId,
                );
                return (
                  <li key={indexGroup.anchorId} className="shrink-0">
                    {positionedGroup ? (
                      <IndexKeyLink
                        href={`#${indexGroup.anchorId}`}
                        label={indexGroup.label}
                        isWide={indexGroup.kind === 'en'}
                        isActive={activeIndexKey === indexGroup.anchorId}
                        onClick={(clickEvent) => handleIndexClick(clickEvent, positionedGroup)}
                      />
                    ) : (
                      <span
                        aria-disabled="true"
                        className={cx(
                          INDEX_KEY_CLASS,
                          indexGroup.kind === 'en' && 'min-w-56',
                          'text-text-disabled',
                        )}
                      >
                        {indexGroup.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </PageContainer>
      </div>
      <PageContainer>
        <div
          ref={directoryListRef}
          id={DIRECTORY_LIST_ID}
          tabIndex={-1}
          className="flex scroll-mt-64 flex-col gap-32 pt-24 focus-ring lg:scroll-mt-80 lg:gap-64 lg:pt-48"
        >
          {positionedGroups.map((indexGroup) => {
            const visibleBrands = indexGroup.brands.slice(
              0,
              Math.max(0, visibleCount - indexGroup.startPosition),
            );
            if (visibleBrands.length === 0) return null;
            return (
              <section
                key={indexGroup.anchorId}
                id={indexGroup.anchorId}
                aria-labelledby={`${indexGroup.anchorId}-heading`}
                className="flex flex-col gap-8 lg:gap-24"
              >
                <h3
                  id={`${indexGroup.anchorId}-heading`}
                  tabIndex={-1}
                  className="flex scroll-mt-64 items-baseline gap-8 border-b border-line-strong pb-8 focus-ring lg:scroll-mt-80 lg:gap-12 lg:pb-16"
                >
                  <span className="text-h2 lg:text-web-h2">{indexGroup.label}</span>
                  <span className="text-label-s text-text-3">{indexGroup.brands.length}개</span>
                </h3>
                <ul className="flex flex-col lg:grid lg:grid-cols-6 lg:gap-24">
                  {visibleBrands.map((brandSummary, brandIndex) => (
                    <li
                      key={brandSummary.id}
                      className="border-b border-line last:border-b-0 lg:border-b-0"
                    >
                      <BrandTile
                        brand={brandSummary}
                        position={indexGroup.startPosition + brandIndex}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        {visibleCount < totalCount ? (
          <div className="mt-40 flex justify-center lg:mt-48">
            <Button
              variant="secondary"
              size="m"
              className="w-full lg:w-240"
              onClick={handleShowMore}
            >
              더 보기 ({visibleCount}/{totalCount})
            </Button>
          </div>
        ) : null}
      </PageContainer>
    </>
  );
}

// Figma HF/IndexKey: 모바일 S 36(터치 영역 44), 데스크톱 M 40
const INDEX_KEY_CLASS =
  'relative inline-flex h-36 min-w-40 items-center justify-center rounded-capsule px-12 text-label-l whitespace-nowrap before:absolute before:inset-x-0 before:-inset-y-4 lg:h-40 lg:before:hidden';

/** 색인 키 링크. 현재 위치(마지막으로 고른 묶음)는 검은 캡슐로 표시합니다. */
function IndexKeyLink({
  href,
  label,
  isWide = false,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  isWide?: boolean;
  isActive: boolean;
  onClick: (clickEvent: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'location' : undefined}
      className={cx(
        INDEX_KEY_CLASS,
        'focus-ring',
        isWide && 'min-w-56',
        isActive ? 'bg-text-1 text-inverse' : 'text-text-1 hover:bg-surface',
      )}
    >
      {label}
    </a>
  );
}

/**
 * 브랜드 항목(Figma HF/BrandTile). 모바일은 72 행, 데스크톱은 196 타일입니다.
 * 항목 전체가 링크 하나이고 접근 이름은 "{브랜드명}, 제품 N개"입니다.
 */
function BrandTile({ brand, position }: { brand: BrandSummary; position: number }) {
  return (
    <Link
      href={buildBrandHref(brand.id)}
      aria-label={`${brand.name}, 제품 ${brand.productCount}개`}
      data-brand-position={position}
      className="group flex items-center gap-12 py-8 focus-ring lg:h-164 lg:flex-col lg:items-stretch lg:gap-16 lg:rounded-8 lg:border lg:border-line lg:bg-bg lg:p-20 lg:transition-colors lg:hover:border-text-1"
    >
      <span className="flex size-56 shrink-0 items-center justify-center overflow-hidden rounded-8 border border-line bg-bg lg:h-64 lg:w-full lg:border-0">
        <BrandLogo
          logoUrl={brand.logoUrl}
          brandName={brand.name}
          className="size-44 lg:h-48 lg:w-120"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-none lg:gap-4">
        <span className="flex min-w-0 items-center gap-4">
          <span className="min-w-0 flex-1 truncate text-title text-text-1">{brand.name}</span>
          <Icon
            icon={ArrowRight}
            size={16}
            className="hidden shrink-0 text-text-3 transition-colors group-hover:text-text-1 lg:block"
          />
        </span>
        <span className="text-caption text-text-3">제품 {brand.productCount}개</span>
      </span>
      <Icon icon={ChevronRight} size={20} className="shrink-0 text-text-1 lg:hidden" />
    </Link>
  );
}
