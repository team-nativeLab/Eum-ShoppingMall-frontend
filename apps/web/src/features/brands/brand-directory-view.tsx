'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { BrandSummary } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { SearchBar } from '@eum/ui/components/SearchBar';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, Search, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { flushSync } from 'react-dom';
import { type FocusEvent, useMemo, useRef, useState } from 'react';
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
import { BrandSpotlightBand } from './brand-spotlight-band';
import {
  ALL_BRAND_INDEX_FILTER,
  BRAND_INDEX_KEYS,
  type BrandIndexFilter,
  type BrandIndexKey,
  type BrandIndexSection,
  filterBrandsByKeyword,
  getBrandIndexKeyDomId,
  getBrandSectionDomId,
  groupBrandsByIndexKey,
  normalizeSearchKeyword,
  sortBrandsForDirectory,
} from './brand-index';
import { useBrandsQuery } from './use-brands-query';

const BRAND_LOAD_ERROR_COPY_MAP = BRAND_LOAD_ERROR_COPY;
/** 선택 브랜드를 URL에 싣는 쿼리 키. 뒤로 가기와 새로고침에서 같은 브랜드를 복원합니다. */
const BRAND_QUERY_KEY = 'brand';
const BRAND_DIRECTORY_TOOLBAR_ID = 'brand-directory-toolbar';
const BRAND_INDEX_KEY_ROW_ID = 'brand-index-key-row';
/**
 * 섹션·툴바 앵커가 sticky 헤더 아래에 보이도록 띄우는 여백입니다(헤더 높이 + 16px).
 * 근거: site-header.tsx의 모바일 상단 행 h-56(56px, 경계선 없음 → 72px),
 * 데스크톱 헤더 h-72 + lg:border-b 1px(스크롤 후 h-64 → 최대 73px, 그래서 89px).
 */
const DIRECTORY_ANCHOR_SCROLL_MARGIN_CLASS = 'scroll-mt-72 lg:scroll-mt-89';
/** 검색 입력은 글자를 칠 때마다 목록을 거르므로, Enter 제출은 추가 동작이 없습니다. */
const NO_OP_SEARCH_SUBMIT = () => undefined;
/** 전체 보기에서 섹션마다 보여 줄 줄 수. 열 수는 타일 그리드(lg 6열, 그 밖 2열)와 맞춥니다. */
const PREVIEW_ROW_COUNT = 2;
const DESKTOP_COLUMN_COUNT = 6;
const MOBILE_COLUMN_COUNT = 2;

/**
 * 밴드가 화면 밖에 있을 때만 밴드 위치로 옮깁니다(사용자가 카드를 눌렀을 때만 호출).
 * 감속 모드를 켠 사용자에게는 부드러운 이동 대신 즉시 이동합니다.
 */
function scrollSpotlightIntoViewIfHidden(band: HTMLElement | null, prefersReducedMotion: boolean) {
  if (!band) return;
  const rect = band.getBoundingClientRect();
  const isOutsideViewport = rect.bottom <= 0 || rect.top >= window.innerHeight;
  if (!isOutsideViewport) return;
  band.scrollIntoView({ block: 'start', behavior: getScrollBehavior(prefersReducedMotion) });
}

/**
 * 키를 눌렀을 때 옮길 대상입니다. 「전체」는 툴바, 그 밖의 키는 키 행입니다.
 * 키 행을 헤더 아래에 맞추면 활성 키의 섹션(또는 검색 결과)이 바로 아래에 와서 키와 섹션 제목이 함께 보입니다.
 * 대상이 DOM에 없으면 null이고, 호출한 쪽이 스크롤을 건너뜁니다.
 */
function getActivationTarget(nextFilter: BrandIndexFilter): HTMLElement | null {
  const targetId =
    nextFilter === ALL_BRAND_INDEX_FILTER ? BRAND_DIRECTORY_TOOLBAR_ID : BRAND_INDEX_KEY_ROW_ID;
  return document.getElementById(targetId);
}

/** 인덱스 키를 눌렀을 때 목록 안의 대상(섹션 또는 툴바)으로 옮깁니다. 대상이 없으면 건너뜁니다. */
function scrollIndexTargetIntoView(target: HTMLElement | null, prefersReducedMotion: boolean) {
  if (!target) return;
  target.scrollIntoView({ block: 'start', behavior: getScrollBehavior(prefersReducedMotion) });
}

/**
 * 키 행(가로 스크롤 컨테이너) 안에서만 누른 키를 보이게 옮깁니다. 문서 세로 스크롤은 건드리지 않아
 * 섹션 이동과 겹쳐 두 번 스크롤되지 않습니다. 키가 이미 보이면 아무것도 하지 않습니다.
 */
function scrollKeyIntoRow(keyButton: HTMLElement, prefersReducedMotion: boolean) {
  const keyRow = keyButton.parentElement;
  if (!keyRow) return;
  const rowRect = keyRow.getBoundingClientRect();
  const keyRect = keyButton.getBoundingClientRect();
  // 행 패딩은 포커스 외곽선이 잘리지 않도록 둔 여백이므로, 보이는 영역은 패딩 안쪽으로 계산합니다.
  const rowPadding = Number.parseFloat(getComputedStyle(keyRow).paddingLeft) || 0;
  const visibleLeft = rowRect.left + rowPadding;
  const visibleRight = rowRect.right - rowPadding;
  let deltaX = 0;
  if (keyRect.left < visibleLeft) deltaX = keyRect.left - visibleLeft;
  if (keyRect.right > visibleRight) deltaX = keyRect.right - visibleRight;
  if (deltaX === 0) return;
  keyRow.scrollBy({ left: deltaX, behavior: getScrollBehavior(prefersReducedMotion) });
}

/** 검색으로 키가 비었거나 데이터가 바뀌어 키가 사라졌으면 「전체」로 돌립니다. */
function resolveAvailableIndexFilter(
  indexFilter: BrandIndexFilter,
  enabledIndexKeys: ReadonlySet<BrandIndexKey>,
): BrandIndexFilter {
  if (indexFilter === ALL_BRAND_INDEX_FILTER || enabledIndexKeys.has(indexFilter)) {
    return indexFilter;
  }
  return ALL_BRAND_INDEX_FILTER;
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
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // 선택은 URL의 brand가 정합니다. 없거나 목록에 없는 id(재조회 등)면 첫 브랜드를 씁니다. 동기화 effect 없이 파생합니다.
  // 검색으로 숨겨져도 선택 브랜드는 전체 목록에서 고르므로, 밴드와 URL은 검색 중에도 그대로 둡니다.
  const requestedBrandId = searchParams.get(BRAND_QUERY_KEY);
  const activeBrand = brands.find((brand) => brand.id === requestedBrandId) ?? brands[0];

  const [searchKeyword, setSearchKeyword] = useState('');
  const [indexFilterState, setIndexFilterState] =
    useState<BrandIndexFilter>(ALL_BRAND_INDEX_FILTER);
  const isSearching = normalizeSearchKeyword(searchKeyword) !== '';
  // 검색 일치 정렬 전: 검색어에 맞는 브랜드 전부(입력 순서 그대로).
  const unsortedKeywordMatches = useMemo(
    () => filterBrandsByKeyword(brands, searchKeyword),
    [brands, searchKeyword],
  );
  // 섹션 그룹 모드와 검색 중 키 집합(어느 키가 비어 있는지)의 기준입니다.
  const sections = useMemo(
    () => groupBrandsByIndexKey(unsortedKeywordMatches),
    [unsortedKeywordMatches],
  );
  // 검색 일치 정렬본: 검색 중 「전체」일 때 섹션 없이 한 목록으로 보여 줄 순서입니다.
  const sortedKeywordMatches = useMemo(
    () => sortBrandsForDirectory(unsortedKeywordMatches),
    [unsortedKeywordMatches],
  );
  const enabledIndexKeys = useMemo(
    () => new Set(sections.map((section) => section.key)),
    [sections],
  );
  const indexFilter = resolveAvailableIndexFilter(indexFilterState, enabledIndexKeys);
  if (indexFilter !== indexFilterState) {
    // 키가 비면 「전체」로 되돌립니다. 같은 렌더 안에서 맞춰 두어 effect로 한 박자 늦게 바뀌지 않게 합니다.
    setIndexFilterState(indexFilter);
  }
  const isPreviewMode = indexFilter === ALL_BRAND_INDEX_FILTER;
  const previewLimit = PREVIEW_ROW_COUNT * (isDesktop ? DESKTOP_COLUMN_COUNT : MOBILE_COLUMN_COUNT);
  // 활성 키가 있으면 그 섹션만 제한 없이 보입니다. 「전체」면 모든 섹션을 미리보기 줄 수로 보입니다.
  const displayedSections = isPreviewMode
    ? sections
    : sections.filter((section) => section.key === indexFilter);
  // 키 교집합 적용본: 검색 중 「전체」면 검색 결과 전부, 키를 누르면 검색 결과 중 그 키의 브랜드만 보입니다.
  const visibleSearchBrands = isPreviewMode
    ? sortedKeywordMatches
    : (sections.find((section) => section.key === indexFilter)?.brands ?? []);

  function handleSelectBrand(brandId: string) {
    // 히스토리 항목을 늘리지 않도록 replace로 갱신하고, 페이지 맨 위로 튀지 않게 scroll을 끕니다.
    router.replace(`/brands?${BRAND_QUERY_KEY}=${encodeURIComponent(brandId)}`, { scroll: false });
    scrollSpotlightIntoViewIfHidden(spotlightRef.current, prefersReducedMotion);
  }

  /** 검색어가 바뀌면 활성 키는 「전체」로 리셋합니다(검색 결과에 따라 키 집합이 달라지므로). */
  function handleSearchKeywordChange(nextKeyword: string) {
    setSearchKeyword(nextKeyword);
    setIndexFilterState(ALL_BRAND_INDEX_FILTER);
  }

  /** 키 행 클릭과 「전체보기」가 함께 쓰는 동작입니다: 필터를 바꾸고 키와 대상 위치로 옮깁니다. */
  function activateIndexFilter(nextFilter: BrandIndexFilter) {
    // 섹션 목록이 새 필터 기준으로 바뀐 뒤에 대상을 찾아야 하므로 상태를 동기로 반영합니다.
    flushSync(() => setIndexFilterState(nextFilter));
    // 누른 키는 키 행 안에서만 가로로 옮기고, 문서 세로 이동은 아래 대상 하나로 끝냅니다.
    // 클릭으로 포커스가 간 키는 포커스 처리에서 이미 행 안으로 옮겨졌으므로, 포커스가 없는 브라우저에서만 옮깁니다.
    const keyButton = document.getElementById(getBrandIndexKeyDomId(nextFilter));
    if (keyButton && document.activeElement !== keyButton) {
      scrollKeyIntoRow(keyButton, prefersReducedMotion);
    }
    const target = getActivationTarget(nextFilter);
    scrollIndexTargetIntoView(target, prefersReducedMotion);
  }

  function handleShowAllInSection(sectionKey: BrandIndexKey) {
    activateIndexFilter(sectionKey);
    // 「전체보기」 버튼은 사라지므로 포커스를 그 섹션 제목으로 옮깁니다(스크롤은 위에서 이미 맞췄습니다).
    document
      .getElementById(`${getBrandSectionDomId(sectionKey)}-heading`)
      ?.focus({ preventScroll: true });
  }

  return (
    <>
      {activeBrand ? <BrandSpotlightBand brand={activeBrand} sectionRef={spotlightRef} /> : null}
      <PageContainer className="flex flex-col gap-40 pt-24 lg:gap-48 lg:pt-48">
        <div
          id={BRAND_DIRECTORY_TOOLBAR_ID}
          className={cx(
            'flex flex-col gap-16 border-b border-line pb-24',
            DIRECTORY_ANCHOR_SCROLL_MARGIN_CLASS,
          )}
        >
          <SearchBar
            value={searchKeyword}
            onValueChange={handleSearchKeywordChange}
            onSearch={NO_OP_SEARCH_SUBMIT}
            placeholder="어떤 브랜드를 찾고 계신가요?"
            label="브랜드 검색"
            className="lg:ml-auto lg:w-320"
          />
          <p role="status" aria-live="polite" className="sr-only">
            {isSearching && unsortedKeywordMatches.length > 0
              ? `브랜드 ${visibleSearchBrands.length}개 검색됨`
              : ''}
          </p>
          <BrandIndexKeyRow
            indexFilter={indexFilter}
            enabledIndexKeys={enabledIndexKeys}
            onSelectIndexFilter={activateIndexFilter}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>
        {unsortedKeywordMatches.length === 0 ? (
          <EmptyState
            icon={Search}
            title="검색 결과가 없습니다"
            description="브랜드 이름이나 영문 이름을 다시 확인해 주세요."
            headingLevel="h3"
          />
        ) : isSearching ? (
          <ul
            aria-label="검색 결과 브랜드"
            className={cx(
              'grid grid-cols-2 gap-12 lg:grid-cols-6 lg:gap-24',
              DIRECTORY_ANCHOR_SCROLL_MARGIN_CLASS,
            )}
          >
            {visibleSearchBrands.map((brand) => (
              <li key={brand.id} className="min-w-0">
                <BrandTile
                  brand={brand}
                  isSelected={brand.id === activeBrand?.id}
                  onSelect={() => handleSelectBrand(brand.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-40 lg:gap-64">
            {displayedSections.map((section) => (
              <BrandIndexSectionBlock
                key={section.key}
                section={section}
                previewLimit={isPreviewMode ? previewLimit : null}
                selectedBrandId={activeBrand?.id}
                onSelectBrand={handleSelectBrand}
                onShowAll={handleShowAllInSection}
              />
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}

function BrandIndexKeyRow({
  indexFilter,
  enabledIndexKeys,
  onSelectIndexFilter,
  prefersReducedMotion,
}: {
  indexFilter: BrandIndexFilter;
  enabledIndexKeys: ReadonlySet<BrandIndexKey>;
  onSelectIndexFilter: (nextFilter: BrandIndexFilter) => void;
  prefersReducedMotion: boolean;
}) {
  // 키보드로 포커스한 키가 행 밖에 있으면 행 안에서 옮겨 외곽선이 잘리지 않게 합니다.
  function handleKeyFocus(focusEvent: FocusEvent<HTMLButtonElement>) {
    scrollKeyIntoRow(focusEvent.currentTarget, prefersReducedMotion);
  }

  // 가로 스크롤 컨테이너는 자식 바깥(외곽선 2px + 오프셋 2px)을 잘라내므로, 패딩 4px를 주고 음수 마진으로 레이아웃은 그대로 둡니다.
  // scroll-p는 브라우저가 포커스 대상을 옮길 때도 이 패딩 안쪽에서 멈추게 합니다.
  return (
    <div
      id={BRAND_INDEX_KEY_ROW_ID}
      role="group"
      aria-label="브랜드 초성·알파벳 인덱스"
      className={cx(
        '-mx-4 -my-4 flex scroll-px-4 scroll-py-4 gap-4 overflow-x-auto px-4 py-4',
        DIRECTORY_ANCHOR_SCROLL_MARGIN_CLASS,
      )}
    >
      <BrandIndexKeyButton
        label="전체"
        filter={ALL_BRAND_INDEX_FILTER}
        isWide
        isActive={indexFilter === ALL_BRAND_INDEX_FILTER}
        isEnabled
        onSelect={() => onSelectIndexFilter(ALL_BRAND_INDEX_FILTER)}
        onFocus={handleKeyFocus}
      />
      {BRAND_INDEX_KEYS.map((indexKey) => (
        <BrandIndexKeyButton
          key={indexKey}
          label={indexKey}
          filter={indexKey}
          isActive={indexFilter === indexKey}
          isEnabled={enabledIndexKeys.has(indexKey)}
          onSelect={() => onSelectIndexFilter(indexKey)}
          onFocus={handleKeyFocus}
        />
      ))}
    </div>
  );
}

function BrandIndexKeyButton({
  label,
  filter,
  isWide = false,
  isActive,
  isEnabled,
  onSelect,
  onFocus,
}: {
  label: string;
  filter: BrandIndexFilter;
  /** 「전체」처럼 글자가 긴 키는 폭을 넓힙니다. */
  isWide?: boolean;
  isActive: boolean;
  /** 현재 검색 결과에 브랜드가 없는 키는 비활성입니다. */
  isEnabled: boolean;
  onSelect: () => void;
  onFocus: (focusEvent: FocusEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      id={getBrandIndexKeyDomId(filter)}
      disabled={!isEnabled}
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
      onFocus={onFocus}
      className={cx(
        'inline-flex h-40 shrink-0 items-center justify-center rounded-capsule px-12 text-label-l focus-ring transition-colors',
        // 포커스로 키가 옮겨질 때도 헤더 아래 상단 여백을 두어 키와 외곽선이 가려지지 않게 합니다.
        DIRECTORY_ANCHOR_SCROLL_MARGIN_CLASS,
        isWide ? 'min-w-56' : 'min-w-40',
        isActive && 'bg-text-1 text-inverse',
        isEnabled && !isActive && 'text-text-1 hover:bg-surface',
        !isEnabled && 'cursor-not-allowed text-text-disabled',
      )}
    >
      {label}
    </button>
  );
}

/**
 * 섹션 하나. previewLimit이 null이면 모든 브랜드를, 숫자면 그 개수까지만 보여 줍니다.
 * 제한을 넘는 섹션에만 「전체보기」 버튼을 둡니다. 헤더의 개수는 제한과 무관하게 전체 개수입니다.
 */
function BrandIndexSectionBlock({
  section,
  previewLimit,
  selectedBrandId,
  onSelectBrand,
  onShowAll,
}: {
  section: BrandIndexSection;
  previewLimit: number | null;
  selectedBrandId: string | undefined;
  onSelectBrand: (brandId: string) => void;
  onShowAll: (sectionKey: BrandIndexKey) => void;
}) {
  const sectionDomId = getBrandSectionDomId(section.key);
  const headingDomId = `${sectionDomId}-heading`;
  const visibleBrands =
    previewLimit === null ? section.brands : section.brands.slice(0, previewLimit);
  const hasHiddenBrands = visibleBrands.length < section.brands.length;

  return (
    <section
      id={sectionDomId}
      aria-labelledby={headingDomId}
      className={cx('flex flex-col gap-24', DIRECTORY_ANCHOR_SCROLL_MARGIN_CLASS)}
    >
      <div className="flex items-baseline gap-12 border-b border-line-strong pb-16">
        <h3
          id={headingDomId}
          tabIndex={-1}
          className="text-h2 text-text-1 focus-ring lg:text-web-h2"
        >
          {section.key}
        </h3>
        <p className="text-label-s text-text-3">
          {section.brands.length.toLocaleString('ko-KR')}개
        </p>
        {hasHiddenBrands ? (
          <button
            type="button"
            aria-label={`${section.key} 브랜드 전체보기`}
            onClick={() => onShowAll(section.key)}
            className="ml-auto inline-flex min-h-40 items-center px-4 text-label-s text-text-2 underline underline-offset-4 focus-ring"
          >
            전체보기
          </button>
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-12 lg:grid-cols-6 lg:gap-24">
        {visibleBrands.map((brand) => (
          <li key={brand.id} className="min-w-0">
            <BrandTile
              brand={brand}
              isSelected={brand.id === selectedBrandId}
              onSelect={() => onSelectBrand(brand.id)}
            />
          </li>
        ))}
      </ul>
    </section>
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
          'flex h-164 w-full flex-col gap-16 overflow-hidden rounded-8 border-2 bg-bg p-16 text-left shadow-1 focus-ring transition-colors',
          isSelected ? 'border-text-1' : 'border-line hover:border-text-accent-black',
        )}
      >
        <span className="flex h-64 w-full items-center justify-center">
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
          {/* 오른쪽 여백(pr-28)은 절대 위치의 화살표 링크(24px + 간격 4px) 자리입니다. */}
          <span className="flex w-full min-w-0 items-center gap-4 pr-28">
            <span
              className={cx(
                'min-w-0 flex-1 truncate text-title text-text-1',
                isSelected ? 'font-bold' : undefined,
              )}
            >
              {brand.name}
            </span>
          </span>
          <span className="text-caption text-text-3">
            제품 {brand.productCount.toLocaleString('ko-KR')}개
          </span>
        </span>
      </button>
      {/* 이름 행의 오른쪽 끝(테두리 2px + 패딩 16px 안쪽)에 맞춘 위치입니다. 타일 본문 선택과 별개로 제품 목록으로 갑니다. */}
      <Link
        href={buildBrandProductsHref(brand.name)}
        aria-label={`${brand.name} 제품 보기`}
        className="absolute top-98 right-18 inline-flex size-24 items-center justify-center rounded-capsule text-text-1 focus-ring hover:bg-surface"
      >
        <Icon icon={ArrowRight} size={16} />
      </Link>
    </div>
  );
}
