'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { ProductListParams } from '@eum/api/shop-api';
import type { Category, FacetCount } from '@eum/api/types';
import { Breadcrumb, type BreadcrumbItem } from '@eum/ui/components/Breadcrumb';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Chip, RemovableChip } from '@eum/ui/components/Chip';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { cx } from '@eum/ui/lib/cx';
import { ChevronDown, LayoutGrid, List, Plus, RotateCcw, SearchX } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PageContainer } from '@/components/page-container';
import { getScrollBehavior, usePrefersReducedMotion } from '@/lib/use-media-query';
import { buildBrandSelectionHref, getBrandFilterValues } from './product-navigation';
import { ProductCard } from './product-card';
import { SearchNoResults } from './search-no-results';
import { useCategoriesQuery } from './use-categories-query';
import { useProductFacetsQuery } from './use-product-facets-query';
import { useProductsQuery } from './use-products-query';

type SortBy = NonNullable<ProductListParams['sortBy']>;
/** 필터 개수 조회 상태(조회 중 / 실패 / 성공) */
type FacetsStatus = 'pending' | 'error' | 'success';
type ActiveFilter =
  | { key: 'price'; label: string }
  | { key: 'brand'; value: string; label: string }
  | { key: 'certification'; value: string; label: string }
  | { key: 'stock'; label: string };

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'recommended', label: '추천순' },
  { value: 'newest', label: '최신순' },
  { value: 'priceAsc', label: '낮은 가격순' },
  { value: 'priceDesc', label: '높은 가격순' },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
/** Figma W-02 기본 표시 개수(24개씩) */
const DEFAULT_PAGE_SIZE = 24;
/** 필터 그룹에서 "더보기" 전에 보여 줄 항목 수 */
const FACET_PREVIEW_COUNT = 5;

const SELECT_CLASS = 'h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s focus-ring';

/** 숫자만 남겨 가격 입력값을 정리하는 함수 */
function toDigits(inputValue: string): string {
  return inputValue.replace(/\D/g, '');
}

/**
 * 카테고리 칩 목록을 정하는 함수.
 * 현재 카테고리에 하위 카테고리가 있으면 그 하위 목록을, 하위 카테고리 화면이면 형제 목록을 보여 줍니다.
 * 첫 칩 "전체"는 기준(상위) 카테고리로 이동합니다.
 */
function getSubcategoryChips(
  categoryList: readonly Category[],
  selectedCategory: Category | undefined,
): { rootCategory: Category; childCategories: Category[] } | null {
  if (!selectedCategory) return null;
  const directChildren = categoryList.filter(
    (category) => category.parentId === selectedCategory.id,
  );
  if (directChildren.length > 0) {
    return { rootCategory: selectedCategory, childCategories: directChildren };
  }
  const parentCategory = categoryList.find((category) => category.id === selectedCategory.parentId);
  if (!parentCategory) return null;
  return {
    rootCategory: parentCategory,
    childCategories: categoryList.filter((category) => category.parentId === parentCategory.id),
  };
}

/** W-02 카테고리와 W-04 검색 결과에서 공통 사용하는 필터·목록 레이아웃입니다. */
export function ProductListingView({
  categorySlug,
  initialKeyword = '',
  initialBrands = [],
  initialBrowseBrands = false,
  initialSearchParams = '',
}: {
  categorySlug?: string;
  initialKeyword?: string;
  initialBrands?: string[];
  initialBrowseBrands?: boolean;
  initialSearchParams?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const categoriesQuery = useCategoriesQuery();
  const categoryList = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const isSearch = categorySlug === undefined;
  const selectedCategory = categorySlug
    ? categoryList.find((category) => category.slug === categorySlug)
    : undefined;
  const [selectedSearchCategoryId, setSelectedSearchCategoryId] = useState<string | undefined>();
  const pageCategoryId = isSearch ? selectedSearchCategoryId : selectedCategory?.id;
  const keyword = initialKeyword.trim();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const normalizedInitialBrands = getBrandFilterValues(initialBrands);
  const initialBrandsKey = JSON.stringify(normalizedInitialBrands);
  const [selectedBrands, setSelectedBrands] = useState(normalizedInitialBrands);
  const [syncedInitialBrandsKey, setSyncedInitialBrandsKey] = useState(initialBrandsKey);
  if (syncedInitialBrandsKey !== initialBrandsKey) {
    setSyncedInitialBrandsKey(initialBrandsKey);
    setSelectedBrands(normalizedInitialBrands);
  }
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [excludeSoldOut, setExcludeSoldOut] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(initialBrowseBrands);
  const [syncedBrowseIntent, setSyncedBrowseIntent] = useState(initialBrowseBrands);
  if (syncedBrowseIntent !== initialBrowseBrands) {
    setSyncedBrowseIntent(initialBrowseBrands);
    setIsMobileFiltersOpen(initialBrowseBrands);
  }
  const mobileBrandGroupRef = useRef<HTMLDivElement>(null);
  const hasFocusedBrandBrowseRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const updateSelectedBrands = (nextBrands: string[]) => {
    const normalizedBrands = getBrandFilterValues(nextBrands);
    setSelectedBrands(normalizedBrands);
    setPage(1);
    const nextHref = buildBrandSelectionHref(pathname, initialSearchParams, normalizedBrands);
    const currentHref = initialSearchParams ? pathname + '?' + initialSearchParams : pathname;
    if (nextHref !== currentHref) router.push(nextHref);
  };

  const toggleBrand = (brand: string) => {
    updateSelectedBrands(
      selectedBrands.includes(brand)
        ? selectedBrands.filter((selectedBrand) => selectedBrand !== brand)
        : [...selectedBrands, brand],
    );
  };

  // 카테고리 화면은 카테고리 목록에서 slug를 확인한 뒤에 조회해, 전체 상품·전체 개수를 먼저 요청하지 않게 합니다.
  const isCategoryResolved = isSearch || selectedCategory !== undefined;
  const facetsQuery = useProductFacetsQuery(
    {
      categoryId: pageCategoryId,
      keyword: isSearch ? keyword || undefined : undefined,
    },
    isCategoryResolved,
  );
  const productParams: ProductListParams = {
    categoryId: pageCategoryId,
    keyword: isSearch ? keyword || undefined : undefined,
    minPrice,
    maxPrice,
    brand: selectedBrands.length > 0 ? selectedBrands : undefined,
    certification: selectedCertifications.length > 0 ? selectedCertifications : undefined,
    excludeSoldOut: excludeSoldOut || undefined,
    sortBy,
    page,
    pageSize,
  };
  // 페이지·필터를 바꾸는 동안 이전 결과를 남겨 두어 페이지 이동 버튼(포커스)이 사라지지 않게 합니다.
  const productsQuery = useProductsQuery(productParams, {
    enabled: isCategoryResolved,
    shouldKeepPreviousData: true,
  });

  const categoryNameById = new Map(categoryList.map((category) => [category.id, category.name]));
  const searchCategoryFacets = (facetsQuery.data?.categories ?? []).filter(
    (categoryFacet) => categoryFacet.count > 0 && categoryNameById.has(categoryFacet.value),
  );
  const subcategoryChips = getSubcategoryChips(categoryList, selectedCategory);
  // 검색어 범위 전체 결과 수(카테고리 칩 선택과 무관). 서버 계약 필드를 그대로 씁니다.
  const keywordTotalCount = facetsQuery.data?.keywordTotalCount;
  const facetsStatus: FacetsStatus = facetsQuery.isError
    ? 'error'
    : facetsQuery.data
      ? 'success'
      : 'pending';
  useEffect(() => {
    if (!initialBrowseBrands) {
      hasFocusedBrandBrowseRef.current = false;
      return;
    }
    if (
      !isMobileFiltersOpen ||
      hasFocusedBrandBrowseRef.current ||
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return;
    }
    const brandGroup = mobileBrandGroupRef.current;
    if (!brandGroup) return;
    const brandChip =
      brandGroup.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      brandGroup.querySelector<HTMLButtonElement>('button:not(:disabled)');
    if (!brandChip && facetsStatus === 'pending') return;
    const focusTarget = brandChip ?? brandGroup;
    focusTarget.focus({ preventScroll: true });
    brandGroup.scrollIntoView({
      behavior: getScrollBehavior(prefersReducedMotion),
      block: 'nearest',
    });
    // Group-only focus on an error must not block a later successful retry from focusing a chip.
    if (brandChip || facetsStatus !== 'error') hasFocusedBrandBrowseRef.current = true;
  }, [facetsStatus, initialBrowseBrands, isMobileFiltersOpen, prefersReducedMotion]);
  const retryFacets = () => void facetsQuery.refetch();

  const activeFilters: ActiveFilter[] = [];
  if (minPrice !== undefined || maxPrice !== undefined) {
    activeFilters.push({
      key: 'price',
      label:
        (minPrice?.toLocaleString('ko-KR') ?? '최소') +
        ' ~ ' +
        (maxPrice?.toLocaleString('ko-KR') ?? '최대'),
    });
  }
  selectedBrands.forEach((brand) =>
    activeFilters.push({ key: 'brand', value: brand, label: brand }),
  );
  selectedCertifications.forEach((certification) =>
    activeFilters.push({ key: 'certification', value: certification, label: certification }),
  );
  if (excludeSoldOut) activeFilters.push({ key: 'stock', label: '품절 상품 제외' });

  const clearFilters = () => {
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setMinPriceInput('');
    setMaxPriceInput('');
    updateSelectedBrands([]);
    setSelectedCertifications([]);
    setExcludeSoldOut(false);
    setPage(1);
  };

  const applyPriceRange = () => {
    setMinPrice(minPriceInput ? Number(minPriceInput) : undefined);
    setMaxPrice(maxPriceInput ? Number(maxPriceInput) : undefined);
    setPage(1);
  };

  const removeFilter = (activeFilter: ActiveFilter) => {
    if (activeFilter.key === 'price') {
      setMinPrice(undefined);
      setMaxPrice(undefined);
      setMinPriceInput('');
      setMaxPriceInput('');
    } else if (activeFilter.key === 'brand') {
      updateSelectedBrands(selectedBrands.filter((brand) => brand !== activeFilter.value));
    } else if (activeFilter.key === 'certification') {
      setSelectedCertifications((currentCertifications) =>
        currentCertifications.filter((certification) => certification !== activeFilter.value),
      );
    } else {
      setExcludeSoldOut(false);
    }
    setPage(1);
  };

  const toggleSelection = (
    selectionList: string[],
    selectionValue: string,
    setSelectionList: (nextList: string[]) => void,
  ) => {
    setSelectionList(
      selectionList.includes(selectionValue)
        ? selectionList.filter((currentValue) => currentValue !== selectionValue)
        : [...selectionList, selectionValue],
    );
    setPage(1);
  };

  const toggleSoldOut = () => {
    setExcludeSoldOut((currentValue) => !currentValue);
    setPage(1);
  };

  const selectSearchCategory = (categoryId: string | undefined) => {
    setSelectedSearchCategoryId(categoryId);
    // 카테고리가 바뀌면 그 범위에 없는 브랜드·인증 선택을 비웁니다.
    updateSelectedBrands([]);
    setSelectedCertifications([]);
    setPage(1);
  };

  if (categorySlug && categoriesQuery.isSuccess && !selectedCategory) {
    return (
      <PageContainer className="py-40">
        <EmptyState
          icon={SearchX}
          title="카테고리를 찾을 수 없습니다"
          description="다른 상품 카테고리를 확인해 주세요."
          action={
            <Link href="/search" className="text-label-m underline focus-ring">
              전체 상품 보기
            </Link>
          }
        />
      </PageContainer>
    );
  }

  // 검색어가 있고 검색 범위 전체에 결과가 없으면 W-04z 빈 상태(사이드바 없음)를 보여 줍니다.
  if (isSearch && keyword && keywordTotalCount === 0) {
    return <SearchNoResults keyword={keyword} />;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: '홈', href: '/' },
    { label: '제품', href: '/search' },
    ...(subcategoryChips && subcategoryChips.rootCategory.id !== selectedCategory?.id
      ? [
          {
            label: subcategoryChips.rootCategory.name,
            href: '/category/' + encodeURIComponent(subcategoryChips.rootCategory.slug),
          },
        ]
      : []),
    { label: selectedCategory?.name ?? '카테고리' },
  ];
  const title = isSearch
    ? keyword
      ? '‘' + keyword + '’ 검색 결과'
      : '전체 상품'
    : (selectedCategory?.name ?? '카테고리');
  const isLoading = categoriesQuery.isPending || productsQuery.isPending || !isCategoryResolved;
  // 이전 결과를 보여 주며 새 페이지·필터 결과를 받는 중
  const isRefreshing = productsQuery.isPlaceholderData;
  const totalCount = productsQuery.data?.totalCount;
  // 페이지 수는 서버가 실제로 적용한 pageSize로 계산합니다(요청 값과 다를 수 있음).
  const pageCount = productsQuery.data
    ? Math.max(
        1,
        Math.ceil(productsQuery.data.totalCount / Math.max(1, productsQuery.data.pageSize)),
      )
    : 1;
  const brandFacets = facetsQuery.data?.brands ?? [];
  const certificationFacets = facetsQuery.data?.certifications ?? [];

  return (
    <PageContainer className={cx('pb-56', isSearch ? 'pt-24 lg:pt-48' : 'pt-24')}>
      {isSearch ? null : (
        <Breadcrumb
          items={breadcrumbs}
          className="mb-24"
          renderLink={(item, className) => (
            <Link href={item.href} className={className}>
              {item.label}
            </Link>
          )}
        />
      )}
      <header className="flex flex-wrap items-end gap-x-12 gap-y-4">
        <h1 className="text-h1 lg:text-display">{title}</h1>
        <p className="pb-2 text-body-s text-text-3 lg:pb-4">
          {isSearch ? '' : '총 '}
          {totalCount === undefined ? '–' : totalCount.toLocaleString('ko-KR')}개
        </p>
      </header>

      {isSearch ? (
        <div
          role="group"
          aria-label="검색 결과 카테고리"
          className="mt-24 flex [scrollbar-width:none] gap-8 overflow-x-auto"
        >
          <Chip
            isSelected={selectedSearchCategoryId === undefined}
            onClick={() => selectSearchCategory(undefined)}
          >
            전체 {keywordTotalCount?.toLocaleString('ko-KR') ?? ''}
          </Chip>
          {searchCategoryFacets.map((categoryFacet) => (
            <Chip
              key={categoryFacet.value}
              isSelected={selectedSearchCategoryId === categoryFacet.value}
              onClick={() => selectSearchCategory(categoryFacet.value)}
            >
              {categoryNameById.get(categoryFacet.value)}{' '}
              {categoryFacet.count.toLocaleString('ko-KR')}
            </Chip>
          ))}
        </div>
      ) : subcategoryChips ? (
        <nav
          aria-label="하위 카테고리"
          className="mt-24 flex [scrollbar-width:none] gap-8 overflow-x-auto"
        >
          {[
            { category: subcategoryChips.rootCategory, label: '전체' },
            ...subcategoryChips.childCategories.map((category) => ({
              category,
              label: category.name,
            })),
          ].map(({ category, label }) => {
            const isCurrent = selectedCategory?.id === category.id;
            return (
              <Link
                key={category.id}
                href={'/category/' + encodeURIComponent(category.slug)}
                aria-current={isCurrent ? 'page' : undefined}
                className={cx(
                  'inline-flex h-36 shrink-0 items-center rounded-capsule px-14 text-label-m whitespace-nowrap focus-ring',
                  isCurrent
                    ? 'bg-text-1 text-inverse'
                    : 'border border-line-strong bg-bg text-text-2 hover:bg-surface',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="mt-16 flex flex-wrap items-center gap-8 lg:hidden">
        <button
          type="button"
          aria-expanded={isMobileFiltersOpen}
          onClick={() => setIsMobileFiltersOpen((currentValue) => !currentValue)}
          className="inline-flex h-40 items-center gap-8 rounded-8 border border-line-strong px-12 text-body-s focus-ring"
        >
          <Icon icon={ChevronDown} size={16} className={isMobileFiltersOpen ? 'rotate-180' : ''} />
          필터
        </button>
        <label className="sr-only" htmlFor="sort-products-mobile">
          정렬
        </label>
        <select
          id="sort-products-mobile"
          value={sortBy}
          onChange={(changeEvent) => {
            const nextSort = SORT_OPTIONS.find(
              (sortOption) => sortOption.value === changeEvent.target.value,
            );
            if (!nextSort) return;
            setSortBy(nextSort.value);
            setPage(1);
          }}
          className={cx(SELECT_CLASS, 'w-140 sm:hidden')}
        >
          {SORT_OPTIONS.map((sortOption) => (
            <option key={sortOption.value} value={sortOption.value}>
              {sortOption.label}
            </option>
          ))}
        </select>
        {isMobileFiltersOpen ? (
          <div className="mt-12 w-full rounded-12 border border-line p-16">
            <div className="grid grid-cols-2 gap-16">
              <label className="text-caption text-text-2">
                최소 가격
                <input
                  inputMode="numeric"
                  value={minPriceInput}
                  onChange={(changeEvent) => setMinPriceInput(toDigits(changeEvent.target.value))}
                  className="mt-4 h-40 w-full rounded-8 border border-line-strong px-8 text-body-s focus-ring"
                />
              </label>
              <label className="text-caption text-text-2">
                최대 가격
                <input
                  inputMode="numeric"
                  value={maxPriceInput}
                  onChange={(changeEvent) => setMaxPriceInput(toDigits(changeEvent.target.value))}
                  className="mt-4 h-40 w-full rounded-8 border border-line-strong px-8 text-body-s focus-ring"
                />
              </label>
            </div>
            {facetsStatus === 'error' ? (
              <FacetsErrorNotice onRetry={retryFacets} className="mt-12" />
            ) : null}
            <h2 id="mobile-brand-filter-heading" className="mt-12 text-label-m">
              브랜드
            </h2>
            <div
              ref={mobileBrandGroupRef}
              role="group"
              aria-labelledby="mobile-brand-filter-heading"
              tabIndex={-1}
              className="mt-8 flex flex-wrap gap-8"
            >
              {brandFacets.map((brandFacet) => (
                <Chip
                  key={brandFacet.value}
                  isSelected={selectedBrands.includes(brandFacet.value)}
                  onClick={() => toggleBrand(brandFacet.value)}
                >
                  {brandFacet.value}
                </Chip>
              ))}
            </div>
            <div role="group" aria-label="안전인증" className="mt-12 flex flex-wrap gap-8">
              {certificationFacets.map((certificationFacet) => (
                <Chip
                  key={certificationFacet.value}
                  isSelected={selectedCertifications.includes(certificationFacet.value)}
                  onClick={() =>
                    toggleSelection(
                      selectedCertifications,
                      certificationFacet.value,
                      setSelectedCertifications,
                    )
                  }
                >
                  {certificationFacet.value}
                </Chip>
              ))}
            </div>
            <div role="group" aria-label="재고 상태" className="mt-12 flex flex-wrap gap-8">
              <Chip isSelected={excludeSoldOut} onClick={toggleSoldOut}>
                품절 상품 제외
              </Chip>
            </div>
            <div className="mt-12 flex gap-8">
              <Button variant="secondary" size="s" onClick={clearFilters}>
                초기화
              </Button>
              <Button size="s" onClick={applyPriceRange}>
                적용
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-24 grid gap-24 lg:mt-40 lg:grid-cols-[196px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="상품 필터">
          <div className="flex h-48 items-center justify-between border-b-2 border-text-1">
            <h2 className="text-label-l">필터</h2>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-4 rounded-4 text-caption-medium text-text-2 focus-ring hover:text-text-1"
            >
              <Icon icon={RotateCcw} size={14} />
              초기화
            </button>
          </div>
          {facetsStatus === 'error' ? (
            <FacetsErrorNotice onRetry={retryFacets} className="mt-16" />
          ) : null}
          <FilterSection title="가격">
            <div className="flex items-center">
              <label className="sr-only" htmlFor="minimum-price">
                최소 가격
              </label>
              <input
                id="minimum-price"
                inputMode="numeric"
                value={minPriceInput}
                onChange={(changeEvent) => setMinPriceInput(toDigits(changeEvent.target.value))}
                placeholder="최소"
                className="h-40 w-86 min-w-0 rounded-8 border border-line-control px-12 text-body-s outline-none placeholder:text-text-3 focus:ring-1 focus:ring-text-1"
              />
              <span aria-hidden="true" className="w-24 text-center text-body-s text-text-3">
                ~
              </span>
              <label className="sr-only" htmlFor="maximum-price">
                최대 가격
              </label>
              <input
                id="maximum-price"
                inputMode="numeric"
                value={maxPriceInput}
                onChange={(changeEvent) => setMaxPriceInput(toDigits(changeEvent.target.value))}
                placeholder="최대"
                className="h-40 w-86 min-w-0 rounded-8 border border-line-control px-12 text-body-s outline-none placeholder:text-text-3 focus:ring-1 focus:ring-text-1"
              />
            </div>
            <Button
              variant="secondary"
              size="s"
              isFullWidth
              className="mt-8"
              onClick={applyPriceRange}
            >
              적용
            </Button>
          </FilterSection>
          <FilterSection title="브랜드">
            <FacetCheckboxList
              facets={brandFacets}
              status={facetsStatus}
              selectedValues={selectedBrands}
              emptyText="브랜드 정보가 없습니다."
              onToggle={toggleBrand}
            />
          </FilterSection>
          <FilterSection title="안전인증">
            <FacetCheckboxList
              facets={certificationFacets}
              status={facetsStatus}
              selectedValues={selectedCertifications}
              emptyText="인증 정보가 없습니다."
              onToggle={(certification) =>
                toggleSelection(selectedCertifications, certification, setSelectedCertifications)
              }
            />
          </FilterSection>
          <FilterSection title="품절 상품">
            <Checkbox
              checked={excludeSoldOut}
              onChange={toggleSoldOut}
              className="h-32 text-text-1"
            >
              품절 상품 제외
            </Checkbox>
          </FilterSection>
        </aside>

        <div className="min-w-0">
          <div className="flex min-h-0 flex-wrap items-center gap-8 sm:min-h-48">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-8">
              {activeFilters.map((activeFilter) => (
                <RemovableChip
                  key={
                    activeFilter.key +
                    (activeFilter.key === 'price' || activeFilter.key === 'stock'
                      ? ''
                      : activeFilter.value)
                  }
                  label={activeFilter.label}
                  onRemove={() => removeFilter(activeFilter)}
                />
              ))}
              {activeFilters.length > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-4 px-4 text-caption-medium text-text-2 underline underline-offset-2 focus-ring hover:text-text-1"
                >
                  전체 해제
                </button>
              ) : null}
            </div>
            <div className="ml-auto hidden flex-wrap items-center gap-8 sm:flex">
              <label className="sr-only" htmlFor="sort-products">
                정렬
              </label>
              <select
                id="sort-products"
                value={sortBy}
                onChange={(changeEvent) => {
                  const nextSort = SORT_OPTIONS.find(
                    (sortOption) => sortOption.value === changeEvent.target.value,
                  );
                  if (!nextSort) return;
                  setSortBy(nextSort.value);
                  setPage(1);
                }}
                className={cx(SELECT_CLASS, 'w-120 lg:w-140')}
              >
                {SORT_OPTIONS.map((sortOption) => (
                  <option key={sortOption.value} value={sortOption.value}>
                    {sortOption.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="page-size">
                페이지 상품 수
              </label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(changeEvent) => {
                  setPageSize(Number(changeEvent.target.value));
                  setPage(1);
                }}
                className={cx(SELECT_CLASS, 'hidden w-120 sm:block')}
              >
                {PAGE_SIZE_OPTIONS.map((pageSizeOption) => (
                  <option key={pageSizeOption} value={pageSizeOption}>
                    {pageSizeOption}개씩
                  </option>
                ))}
              </select>
              <div
                role="group"
                aria-label="보기 방식"
                className="hidden h-40 w-80 items-center justify-center gap-2 rounded-8 bg-surface p-2 sm:flex lg:w-78"
              >
                <ViewToggleButton
                  label="그리드 보기"
                  isSelected={layout === 'grid'}
                  onSelect={() => setLayout('grid')}
                  icon={<Icon icon={LayoutGrid} size={16} />}
                />
                <ViewToggleButton
                  label="목록 보기"
                  isSelected={layout === 'list'}
                  onSelect={() => setLayout('list')}
                  icon={<Icon icon={List} size={16} />}
                />
              </div>
            </div>
          </div>

          <div
            className={cx(
              'mt-8 transition-opacity motion-reduce:transition-none sm:mt-16',
              isRefreshing && 'opacity-60',
            )}
            aria-busy={isRefreshing || undefined}
          >
            {isLoading ? (
              <div
                aria-busy="true"
                className="grid grid-cols-2 gap-x-12 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-24 lg:gap-y-40"
              >
                {Array.from({ length: 8 }, (_, skeletonIndex) => (
                  <div
                    key={skeletonIndex}
                    className="aspect-[3/4] animate-pulse rounded-8 bg-surface"
                  />
                ))}
              </div>
            ) : productsQuery.isError || categoriesQuery.isError ? (
              <NoticeInline tone="danger" role="alert">
                {getApiFailureKind(productsQuery.error) === 'notImplemented'
                  ? '상품 조회 기능을 준비하고 있습니다.'
                  : '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
              </NoticeInline>
            ) : productsQuery.data?.items.length ? (
              <ul
                className={
                  layout === 'grid'
                    ? 'grid grid-cols-2 gap-x-12 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-24 lg:gap-y-40'
                    : 'flex flex-col gap-12'
                }
              >
                {productsQuery.data.items.map((product) => (
                  <li key={product.id} className="min-w-0">
                    <ProductCard product={product} layout={layout} className="h-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-12 border border-line">
                <EmptyState
                  icon={SearchX}
                  title={
                    activeFilters.length > 0
                      ? '조건에 맞는 상품이 없습니다'
                      : '등록된 상품이 없습니다'
                  }
                  description={
                    activeFilters.length > 0 ? '필터 조건을 바꿔 다시 확인해 주세요.' : undefined
                  }
                  action={
                    activeFilters.length > 0 ? (
                      <Button variant="secondary" size="m" onClick={clearFilters}>
                        필터 전체 해제
                      </Button>
                    ) : (
                      <Link
                        href="/search"
                        className="inline-flex h-48 items-center rounded-8 border border-line-strong px-16 text-label-m focus-ring hover:bg-surface"
                      >
                        전체 상품 보기
                      </Link>
                    )
                  }
                />
              </div>
            )}
          </div>
          <Pagination
            currentPage={page}
            totalPages={pageCount}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              // 포커스는 누른 페이지 버튼에 그대로 두고 화면만 목록 위로 올립니다.
              window.scrollTo({ top: 0, behavior: getScrollBehavior(prefersReducedMotion) });
            }}
            className="mt-40 flex justify-center lg:mt-64"
          />
        </div>
      </div>
    </PageContainer>
  );
}

/** 보기 방식 토글 버튼(Figma view-toggle 36px, 선택 시 흰 바탕 + sh-1) */
function ViewToggleButton({
  label,
  isSelected,
  onSelect,
  icon,
}: {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={isSelected}
      className={cx(
        'inline-flex size-36 items-center justify-center rounded-6 focus-ring',
        isSelected ? 'bg-bg shadow-1' : 'text-text-3 hover:text-text-1',
      )}
    >
      {icon}
    </button>
  );
}

/** 접고 펼 수 있는 필터 그룹(Figma FilterSidebar group: 제목 56 · 아래 여백 20) */
function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <section className="border-b border-line pb-20">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          className="flex h-56 w-full items-center justify-between rounded-4 text-left text-label-l focus-ring"
        >
          {title}
          <Icon
            icon={ChevronDown}
            size={20}
            className={cx(
              'transition-transform motion-reduce:transition-none',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </h3>
      {isOpen ? <div>{children}</div> : null}
    </section>
  );
}

/** 필터 개수 조회 실패 안내 + 다시 시도(빈 데이터 상태와 구분) */
function FacetsErrorNotice({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <NoticeInline tone="danger" role="alert" className={className}>
      필터 정보를 불러오지 못했습니다.{' '}
      <button type="button" onClick={onRetry} className="rounded-4 underline focus-ring">
        다시 시도
      </button>
    </NoticeInline>
  );
}

/**
 * 개수가 붙은 체크박스 목록. 5개를 넘으면 "더보기"로 나머지를 펼칩니다.
 * 조회 중이면 불러오는 중 문구를, 실패하면 아무것도 그리지 않습니다(실패 안내는 필터 위에 한 번만 보여 줌).
 */
function FacetCheckboxList({
  facets,
  status,
  selectedValues,
  emptyText,
  onToggle,
}: {
  facets: FacetCount[];
  status: FacetsStatus;
  selectedValues: string[];
  emptyText: string;
  onToggle: (facetValue: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (status === 'pending') {
    return <p className="text-caption text-text-3">불러오는 중입니다.</p>;
  }
  if (status === 'error') return null;
  if (facets.length === 0) return <p className="text-caption text-text-3">{emptyText}</p>;
  // 선택한 항목은 접혀 있어도 보이게 합니다.
  const visibleFacets = isExpanded
    ? facets
    : facets.filter(
        (facet, facetIndex) =>
          facetIndex < FACET_PREVIEW_COUNT || selectedValues.includes(facet.value),
      );
  const hiddenCount = facets.length - visibleFacets.length;
  return (
    <div className="flex flex-col items-start gap-4">
      {visibleFacets.map((facet) => (
        <Checkbox
          key={facet.value}
          checked={selectedValues.includes(facet.value)}
          onChange={() => onToggle(facet.value)}
          className="h-32"
        >
          <span>{facet.value}</span>
          <span className="text-caption text-text-3">
            {facet.count.toLocaleString('ko-KR')}
            <span className="sr-only">개</span>
          </span>
        </Checkbox>
      ))}
      {hiddenCount > 0 || isExpanded ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="mt-4 inline-flex items-center gap-4 rounded-4 text-caption-medium text-text-2 focus-ring hover:text-text-1"
        >
          {isExpanded ? '접기' : '더보기'}
          <Icon
            icon={isExpanded ? ChevronDown : Plus}
            size={14}
            className={cx(isExpanded && 'rotate-180')}
          />
        </button>
      ) : null}
    </div>
  );
}
