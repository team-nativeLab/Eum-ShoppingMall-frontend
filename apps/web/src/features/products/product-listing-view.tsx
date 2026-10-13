'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { ProductListParams } from '@eum/api/shop-api';
import type { Category } from '@eum/api/types';
import { Breadcrumb, type BreadcrumbItem } from '@eum/ui/components/Breadcrumb';
import { Button } from '@eum/ui/components/Button';
import { Chip, RemovableChip } from '@eum/ui/components/Chip';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { SearchX, RotateCcw, Grid2X2, List, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PageContainer } from '@/components/page-container';
import { ProductCard } from './product-card';
import { useCategoriesQuery } from './use-categories-query';
import { useProductsQuery } from './use-products-query';

type SortBy = NonNullable<ProductListParams['sortBy']>;
type ActiveFilter =
  | { key: 'price'; label: string }
  | { key: 'brand'; value: string; label: string }
  | { key: 'certification'; value: string; label: string }
  | { key: 'stock'; label: string };

/** W-02 카테고리와 W-04 검색 결과에서 공통 사용하는 필터·목록 레이아웃입니다. */
export function ProductListingView({
  categorySlug,
  initialKeyword = '',
}: {
  categorySlug?: string;
  initialKeyword?: string;
}) {
  const categoriesQuery = useCategoriesQuery();
  const categoryList = categoriesQuery.data ?? [];
  const isSearch = categorySlug === undefined;
  const selectedCategory = categorySlug
    ? categoryList.find((category) => category.slug === categorySlug)
    : undefined;
  const [selectedSearchCategoryId, setSelectedSearchCategoryId] = useState<string | undefined>();
  const pageCategoryId = isSearch ? selectedSearchCategoryId : selectedCategory?.id;
  const keyword = initialKeyword;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [excludeSoldOut, setExcludeSoldOut] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const catalogQuery = useProductsQuery({
    categoryId: pageCategoryId,
    keyword: isSearch ? keyword : undefined,
    pageSize: 100,
  });
  const productParams: ProductListParams = useMemo(
    () => ({
      categoryId: pageCategoryId,
      keyword: isSearch ? keyword.trim() || undefined : undefined,
      minPrice,
      maxPrice,
      brand: selectedBrands.length > 0 ? selectedBrands : undefined,
      certification: selectedCertifications.length > 0 ? selectedCertifications : undefined,
      excludeSoldOut: excludeSoldOut || undefined,
      sortBy,
      page,
      pageSize,
    }),
    [
      excludeSoldOut,
      isSearch,
      keyword,
      maxPrice,
      minPrice,
      page,
      pageCategoryId,
      pageSize,
      selectedBrands,
      selectedCertifications,
      sortBy,
    ],
  );
  const productsQuery = useProductsQuery(productParams);

  const facetProducts = catalogQuery.data?.items ?? [];
  const brands = [...new Set(facetProducts.map((product) => product.brand))];
  const certifications = [...new Set(facetProducts.flatMap((product) => product.certifications))];
  const categoryTabs = categoryList.filter((category) => category.parentId === null);
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
    setSelectedBrands([]);
    setSelectedCertifications([]);
    setExcludeSoldOut(false);
    setPage(1);
  };

  const removeFilter = (activeFilter: ActiveFilter) => {
    if (activeFilter.key === 'price') {
      setMinPrice(undefined);
      setMaxPrice(undefined);
      setMinPriceInput('');
      setMaxPriceInput('');
    } else if (activeFilter.key === 'brand') {
      setSelectedBrands((currentBrands) =>
        currentBrands.filter((brand) => brand !== activeFilter.value),
      );
    } else if (activeFilter.key === 'certification') {
      setSelectedCertifications((currentCertifications) =>
        currentCertifications.filter((certification) => certification !== activeFilter.value),
      );
    } else {
      setExcludeSoldOut(false);
    }
    setPage(1);
  };

  const updateSelections = (
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

  const breadcrumbs: BreadcrumbItem[] = isSearch
    ? [{ label: '홈', href: '/' }, { label: '검색 결과' }]
    : [
        { label: '홈', href: '/' },
        { label: '제품', href: '/search' },
        { label: selectedCategory?.name ?? '카테고리' },
      ];

  const title = isSearch
    ? keyword.trim()
      ? '‘' + keyword.trim() + '’ 검색 결과'
      : '검색 결과'
    : (selectedCategory?.name ?? '카테고리');
  const isLoading = categoriesQuery.isPending || catalogQuery.isPending || productsQuery.isPending;
  const pageCount = productsQuery.data
    ? Math.max(1, Math.ceil(productsQuery.data.totalCount / pageSize))
    : 1;

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

  return (
    <PageContainer className="pt-24 pb-64 lg:pt-20">
      <Breadcrumb
        items={breadcrumbs}
        renderLink={(item, className) => (
          <Link href={item.href} className={className}>
            {item.label}
          </Link>
        )}
      />
      <header className="mt-24 flex flex-wrap items-baseline gap-12">
        <h1 className="text-web-h2">{title}</h1>
        <span className="text-caption text-text-3">
          {productsQuery.data ? productsQuery.data.totalCount.toLocaleString('ko-KR') : '–'}개
        </span>
      </header>

      <nav aria-label="상품 분류" className="mt-16 flex gap-8 overflow-x-auto pb-4">
        {isSearch ? (
          <Chip
            isSelected={pageCategoryId === undefined}
            onClick={() => {
              setSelectedSearchCategoryId(undefined);
              setPage(1);
            }}
          >
            전체
          </Chip>
        ) : null}
        {categoryTabs.map((category) =>
          isSearch ? (
            <Chip
              key={category.id}
              isSelected={pageCategoryId === category.id}
              onClick={() => {
                setSelectedSearchCategoryId(category.id);
                setPage(1);
              }}
            >
              {category.name}
            </Chip>
          ) : (
            <Link
              key={category.id}
              href={'/category/' + encodeURIComponent(category.slug)}
              aria-current={selectedCategory?.id === category.id ? 'page' : undefined}
              className={
                selectedCategory?.id === category.id
                  ? 'inline-flex h-36 shrink-0 items-center rounded-capsule bg-text-1 px-14 text-label-m text-inverse focus-ring'
                  : 'inline-flex h-36 shrink-0 items-center rounded-capsule border border-line-strong px-14 text-label-m text-text-2 focus-ring hover:bg-surface'
              }
            >
              {category.name}
            </Link>
          ),
        )}
      </nav>

      <div className="mt-16 lg:hidden">
        <button
          type="button"
          aria-expanded={isMobileFiltersOpen}
          onClick={() => setIsMobileFiltersOpen((currentValue) => !currentValue)}
          className="inline-flex h-40 items-center gap-8 rounded-8 border border-line-strong px-12 text-body-s focus-ring"
        >
          <Icon icon={ChevronDown} size={16} className={isMobileFiltersOpen ? 'rotate-180' : ''} />
          필터
        </button>
        {isMobileFiltersOpen ? (
          <div className="mt-12 rounded-12 border border-line p-16">
            <div className="grid grid-cols-2 gap-16">
              <label className="text-caption text-text-2">
                최소 가격
                <input
                  inputMode="numeric"
                  value={minPriceInput}
                  onChange={(changeEvent) =>
                    setMinPriceInput(changeEvent.target.value.replace(/\D/g, ''))
                  }
                  className="mt-4 h-40 w-full rounded-8 border border-line-strong px-8 text-body-s focus-ring"
                />
              </label>
              <label className="text-caption text-text-2">
                최대 가격
                <input
                  inputMode="numeric"
                  value={maxPriceInput}
                  onChange={(changeEvent) =>
                    setMaxPriceInput(changeEvent.target.value.replace(/\D/g, ''))
                  }
                  className="mt-4 h-40 w-full rounded-8 border border-line-strong px-8 text-body-s focus-ring"
                />
              </label>
            </div>
            <div className="mt-12 flex flex-wrap gap-8">
              {brands.map((brand) => (
                <Chip
                  key={brand}
                  isSelected={selectedBrands.includes(brand)}
                  onClick={() => updateSelections(selectedBrands, brand, setSelectedBrands)}
                >
                  {brand}
                </Chip>
              ))}
              {certifications.map((certification) => (
                <Chip
                  key={certification}
                  isSelected={selectedCertifications.includes(certification)}
                  onClick={() =>
                    updateSelections(
                      selectedCertifications,
                      certification,
                      setSelectedCertifications,
                    )
                  }
                >
                  {certification}
                </Chip>
              ))}
              <Chip
                isSelected={excludeSoldOut}
                onClick={() => {
                  setExcludeSoldOut((currentValue) => !currentValue);
                  setPage(1);
                }}
              >
                품절 상품 제외
              </Chip>
            </div>
            <div className="mt-12 flex gap-8">
              <Button variant="secondary" size="s" onClick={clearFilters}>
                초기화
              </Button>
              <Button
                size="s"
                onClick={() => {
                  setMinPrice(minPriceInput ? Number(minPriceInput) : undefined);
                  setMaxPrice(maxPriceInput ? Number(maxPriceInput) : undefined);
                  setPage(1);
                }}
              >
                적용
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-32 grid gap-24 lg:grid-cols-[196px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="상품 필터">
          <div className="flex items-center justify-between border-b border-text-1 pb-12">
            <h2 className="text-body-s-medium">필터</h2>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-4 rounded-4 text-caption text-text-3 focus-ring hover:text-text-1"
            >
              <Icon icon={RotateCcw} size={14} />
              초기화
            </button>
          </div>
          <FilterSection title="가격">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <label className="sr-only" htmlFor="minimum-price">
                최소 가격
              </label>
              <input
                id="minimum-price"
                inputMode="numeric"
                value={minPriceInput}
                onChange={(changeEvent) =>
                  setMinPriceInput(changeEvent.target.value.replace(/\D/g, ''))
                }
                placeholder="최소"
                className="h-40 min-w-0 rounded-8 border border-line-strong px-8 text-body-s outline-none focus:ring-1 focus:ring-text-1"
              />
              <span className="text-caption text-text-3">~</span>
              <label className="sr-only" htmlFor="maximum-price">
                최대 가격
              </label>
              <input
                id="maximum-price"
                inputMode="numeric"
                value={maxPriceInput}
                onChange={(changeEvent) =>
                  setMaxPriceInput(changeEvent.target.value.replace(/\D/g, ''))
                }
                placeholder="최대"
                className="h-40 min-w-0 rounded-8 border border-line-strong px-8 text-body-s outline-none focus:ring-1 focus:ring-text-1"
              />
            </div>
            <Button
              variant="secondary"
              size="s"
              isFullWidth
              className="mt-8"
              onClick={() => {
                setMinPrice(minPriceInput ? Number(minPriceInput) : undefined);
                setMaxPrice(maxPriceInput ? Number(maxPriceInput) : undefined);
                setPage(1);
              }}
            >
              적용
            </Button>
          </FilterSection>
          <FilterSection title="브랜드">
            {brands.length ? (
              brands.map((brand) => (
                <FilterCheckbox
                  key={brand}
                  label={brand}
                  checked={selectedBrands.includes(brand)}
                  onChange={() => updateSelections(selectedBrands, brand, setSelectedBrands)}
                />
              ))
            ) : (
              <p className="text-caption text-text-3">브랜드 정보가 없습니다.</p>
            )}
          </FilterSection>
          <FilterSection title="안전인증">
            {certifications.length ? (
              certifications.map((certification) => (
                <FilterCheckbox
                  key={certification}
                  label={certification}
                  checked={selectedCertifications.includes(certification)}
                  onChange={() =>
                    updateSelections(
                      selectedCertifications,
                      certification,
                      setSelectedCertifications,
                    )
                  }
                />
              ))
            ) : (
              <p className="text-caption text-text-3">인증 정보가 없습니다.</p>
            )}
          </FilterSection>
          <FilterSection title="품절 상품">
            <FilterCheckbox
              label="품절 상품 제외"
              checked={excludeSoldOut}
              onChange={() => {
                setExcludeSoldOut((currentValue) => !currentValue);
                setPage(1);
              }}
            />
          </FilterSection>
        </aside>

        <div className="min-w-0">
          <div className="mb-12 flex flex-wrap items-center gap-8">
            <div className="flex min-w-0 flex-1 flex-wrap gap-8">
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
                  className="rounded-4 px-8 text-caption text-text-2 underline focus-ring"
                >
                  전체 해제
                </button>
              ) : null}
            </div>
            <div className="ml-auto flex items-center gap-8">
              <label className="sr-only" htmlFor="sort-products">
                정렬
              </label>
              <select
                id="sort-products"
                value={sortBy}
                onChange={(changeEvent) => {
                  setSortBy(changeEvent.target.value as SortBy);
                  setPage(1);
                }}
                className="h-40 rounded-8 border border-line-strong bg-bg px-12 text-body-s focus-ring"
              >
                <option value="recommended">추천순</option>
                <option value="newest">최신순</option>
                <option value="priceAsc">낮은 가격순</option>
                <option value="priceDesc">높은 가격순</option>
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
                className="hidden h-40 rounded-8 border border-line-strong bg-bg px-12 text-body-s focus-ring sm:block"
              >
                <option value={12}>12개씩</option>
                <option value={24}>24개씩</option>
                <option value={48}>48개씩</option>
              </select>
              <div className="hidden rounded-8 bg-surface p-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setLayout('grid')}
                  aria-label="그리드 보기"
                  aria-pressed={layout === 'grid'}
                  className="inline-flex size-36 items-center justify-center rounded-6 focus-ring"
                >
                  <Icon icon={Grid2X2} size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('list')}
                  aria-label="목록 보기"
                  aria-pressed={layout === 'list'}
                  className="inline-flex size-36 items-center justify-center rounded-6 focus-ring"
                >
                  <Icon icon={List} size={16} />
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div
              aria-busy="true"
              className="grid grid-cols-2 gap-12 sm:grid-cols-3 lg:grid-cols-4 lg:gap-24"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="aspect-[3/4] animate-pulse rounded-8 bg-surface" />
              ))}
            </div>
          ) : productsQuery.isError || categoriesQuery.isError || catalogQuery.isError ? (
            <NoticeInline tone="danger" role="alert">
              {getApiFailureKind(productsQuery.error) === 'notImplemented'
                ? '상품 조회 기능을 준비하고 있습니다.'
                : '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
            </NoticeInline>
          ) : productsQuery.data?.items.length ? (
            <ul
              className={
                layout === 'grid'
                  ? 'grid grid-cols-2 gap-12 sm:grid-cols-3 lg:grid-cols-4 lg:gap-24'
                  : 'space-y-12'
              }
            >
              {productsQuery.data.items.map((product) => (
                <li key={product.id} className="min-w-0">
                  <ProductCard product={product} layout={layout} />
                </li>
              ))}
            </ul>
          ) : (
            <NoResults keyword={keyword} categories={categoryList} />
          )}
          <Pagination
            currentPage={page}
            totalPages={pageCount}
            onPageChange={setPage}
            className="mt-40 flex justify-center"
          />
        </div>
      </div>
    </PageContainer>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <section className="border-b border-line py-16">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="flex w-full items-center justify-between rounded-4 text-left text-body-s-medium focus-ring"
      >
        {title}
        <Icon
          icon={ChevronDown}
          size={16}
          className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>
      {isOpen ? <div className="mt-12 space-y-8">{children}</div> : null}
    </section>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-24 cursor-pointer items-center gap-8 text-caption text-text-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-16 accent-text-1 focus-ring"
      />
      <span>{label}</span>
    </label>
  );
}

function NoResults({ keyword, categories }: { keyword: string; categories: Category[] }) {
  return (
    <div className="min-h-480 rounded-12 border border-line">
      <EmptyState
        icon={SearchX}
        title={keyword ? '‘' + keyword + '’에 대한 검색 결과가 없습니다' : '등록된 상품이 없습니다'}
        description="단어의 철자와 검색 조건을 확인한 뒤 다시 검색해 보세요."
        action={
          <Link
            href="/search"
            className="inline-flex h-40 items-center rounded-8 border border-line-strong px-16 text-label-m focus-ring hover:bg-surface"
          >
            전체 상품 보기
          </Link>
        }
      />
      {categories.length > 0 ? (
        <div className="mx-auto max-w-520 px-20 pb-40 text-center">
          <p className="text-body-s-medium">상품 카테고리 둘러보기</p>
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            {categories
              .filter((category) => category.parentId === null)
              .slice(0, 5)
              .map((category) => (
                <Link
                  key={category.id}
                  href={'/category/' + encodeURIComponent(category.slug)}
                  className="inline-flex h-36 items-center rounded-capsule border border-line-strong px-14 text-label-s focus-ring hover:bg-surface"
                >
                  {category.name}
                </Link>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
