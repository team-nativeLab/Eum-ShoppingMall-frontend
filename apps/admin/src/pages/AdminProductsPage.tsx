import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Pagination } from '@eum/ui/components/Pagination';
import { Switch } from '@eum/ui/components/Switch';
import { Modal } from '@eum/ui/components/Modal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTabs,
  formatAdminCurrency,
  formatAdminDate,
} from '@/components/AdminUI';
import { PriceVisibilityConfirmDialog } from '@/components/PriceVisibilityConfirmDialog';
import { getShopApi } from '@/lib/shop-api';
import { getAdminApiConfig } from '@/lib/api-config';
import type { AdminProduct, Category, Product } from '@eum/api/types';

type ProductTab = 'all' | 'active' | 'soldOut' | 'hiddenPrice' | 'hiddenExposure';
interface ProductListData {
  products: AdminProduct[];
  categories: Category[];
  totalCount: number;
}

interface AdminProductSaveOutcome {
  savedCount: number;
  failedProducts: AdminProduct[];
  isCacheRefreshSuccessful: boolean;
}

const PRODUCT_TABS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '판매중' },
  { value: 'soldOut', label: '품절' },
  { value: 'hiddenExposure', label: '숨김' },
  { value: 'hiddenPrice', label: '금액 미표시' },
] as const satisfies readonly { value: ProductTab; label: string }[];

/** 목록 조회 API 결과에서 필요한 상품과 카테고리를 함께 불러옵니다. */
async function loadProducts(
  keyword: string,
  categoryId: string,
  signal: AbortSignal,
): Promise<ProductListData> {
  const api = await getShopApi();
  const [products, categories] = await Promise.all([
    api.products.adminList({ signal }),
    api.categories.list({ signal }),
  ]);
  const categoryIds = new Set<string>();
  if (categoryId) {
    const addDescendants = (parentId: string) => {
      categoryIds.add(parentId);
      categories
        .filter((category) => category.parentId === parentId)
        .forEach((category) => addDescendants(category.id));
    };
    addDescendants(categoryId);
  }
  const normalizedKeyword = keyword.toLocaleLowerCase('ko-KR');
  const filteredProducts = products.filter(
    (product) =>
      (!normalizedKeyword ||
        `${product.name} ${product.brand} ${product.productCode ?? ''}`
          .toLocaleLowerCase('ko-KR')
          .includes(normalizedKeyword)) &&
      (!categoryId || categoryIds.has(product.categoryId)),
  );
  return { products: filteredProducts, categories, totalCount: filteredProducts.length };
}

/** 상품의 카테고리를 상위 분류와 함께 읽기 쉽게 표시합니다. */
function categoryPath(categoryId: string, categories: Category[]): string {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const category = categoryById.get(categoryId);
  if (!category) return '분류 정보 없음';
  if (!category.parentId) return category.name;
  const parent = categoryById.get(category.parentId);
  return parent ? parent.name + ' > ' + category.name : category.name;
}

/** Admin 상품을 조회하고, API를 통해 상품 설정을 저장합니다. */
export function AdminProductsPage() {
  const persistenceTargetLabel = getAdminApiConfig().mode === 'mock' ? '목 API' : '서버 API';
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [salesStatus, setSalesStatus] = useState('all');
  const [priceVisibility, setPriceVisibility] = useState('all');
  const [exposure, setExposure] = useState('all');
  const [tab, setTab] = useState<ProductTab>('all');
  const [sortOrder, setSortOrder] = useState('recent');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [stockStatusOverrides, setStockStatusOverrides] = useState<
    Partial<Record<string, Product['stockStatus']>>
  >({});
  const [pendingHideProducts, setPendingHideProducts] = useState<AdminProduct[]>([]);
  const [priceVisibilityAnnouncement, setPriceVisibilityAnnouncement] = useState('');
  const [savingProductIds, setSavingProductIds] = useState<ReadonlySet<string>>(() => new Set());
  const savingProductIdsRef = useRef(new Set<string>());
  const productQuery = useQuery({
    queryKey: ['admin', 'products', keyword, categoryId],
    queryFn: ({ signal }) => loadProducts(keyword, categoryId, signal),
  });
  const queryClient = useQueryClient();

  const visibleProducts = useMemo(() => {
    if (!productQuery.data) return [];
    return productQuery.data.products
      .map((product) => ({
        ...product,
        stockStatus: stockStatusOverrides[product.id] ?? product.stockStatus,
      }))
      .filter((product) => {
        if (tab === 'active') return (product.salesStatus ?? 'active') === 'active';
        if (tab === 'soldOut') return product.stockStatus === 'soldOut';
        if (tab === 'hiddenPrice') return !product.priceVisible;
        if (tab === 'hiddenExposure') return !(product.isVisible ?? true);
        return true;
      })
      .filter(
        (product) => salesStatus === 'all' || (product.salesStatus ?? 'active') === salesStatus,
      )
      .filter(
        (product) =>
          priceVisibility === 'all' ||
          (priceVisibility === 'visible' ? product.priceVisible : !product.priceVisible),
      )
      .filter(
        (product) =>
          exposure === 'all' ||
          (exposure === 'visible' ? (product.isVisible ?? true) : !(product.isVisible ?? true)),
      )
      .toSorted((left, right) =>
        sortOrder === 'oldest'
          ? left.createdAt.localeCompare(right.createdAt)
          : right.createdAt.localeCompare(left.createdAt),
      );
  }, [
    productQuery.data,
    salesStatus,
    priceVisibility,
    exposure,
    sortOrder,
    stockStatusOverrides,
    tab,
  ]);
  const allFilteredProducts = useMemo(() => {
    if (!productQuery.data) return [];
    return productQuery.data.products
      .map((product) => ({
        ...product,
        stockStatus: stockStatusOverrides[product.id] ?? product.stockStatus,
      }))
      .filter(
        (product) => salesStatus === 'all' || (product.salesStatus ?? 'active') === salesStatus,
      )
      .filter(
        (product) =>
          priceVisibility === 'all' ||
          (priceVisibility === 'visible' ? product.priceVisible : !product.priceVisible),
      )
      .filter(
        (product) =>
          exposure === 'all' ||
          (exposure === 'visible' ? (product.isVisible ?? true) : !(product.isVisible ?? true)),
      );
  }, [productQuery.data, salesStatus, priceVisibility, exposure, stockStatusOverrides]);

  if (productQuery.isPending) return <AdminLoading label="상품 목록을 불러오고 있습니다." />;
  if (productQuery.isError && !productQuery.data)
    return <AdminError onRetry={() => void productQuery.refetch()} />;

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = visibleProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedProducts = visibleProducts.filter((product) => selectedIds.includes(product.id));
  const tabOptions = PRODUCT_TABS.map((option) => ({
    ...option,
    count: allFilteredProducts.filter((product) => {
      const currentStatus = stockStatusOverrides[product.id] ?? product.stockStatus;
      if (option.value === 'active') return (product.salesStatus ?? 'active') === 'active';
      if (option.value === 'soldOut') return currentStatus === 'soldOut';
      if (option.value === 'hiddenPrice') return !product.priceVisible;
      if (option.value === 'hiddenExposure') return !(product.isVisible ?? true);
      return true;
    }).length,
  }));
  const saveAdminProducts = async (
    products: AdminProduct[],
    update: Partial<AdminProduct>,
  ): Promise<AdminProductSaveOutcome> => {
    const api = await getShopApi();
    let savedCount = 0;
    const failedProducts: AdminProduct[] = [];
    for (const product of products) {
      try {
        await api.products.saveAdmin({ ...product, ...update });
        savedCount += 1;
      } catch {
        failedProducts.push(product);
      }
    }
    const invalidationResults = await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }, { throwOnError: true }),
      queryClient.invalidateQueries({ queryKey: ['products'] }, { throwOnError: true }),
      queryClient.invalidateQueries({ queryKey: ['home', 'content'] }, { throwOnError: true }),
    ]);
    return {
      savedCount,
      failedProducts,
      isCacheRefreshSuccessful: invalidationResults.every(
        (result) => result.status === 'fulfilled',
      ),
    };
  };

  const announceProductSave = (
    label: string,
    productCount: number,
    outcome: AdminProductSaveOutcome,
  ) => {
    const failedCount = outcome.failedProducts.length;
    const refreshMessage = outcome.isCacheRefreshSuccessful
      ? '목록과 관련 화면을 새로고침했습니다.'
      : '저장은 처리했지만 관련 화면을 갱신하지 못했습니다. 다시 조회해 주세요.';
    if (failedCount === 0 && outcome.isCacheRefreshSuccessful) {
      setPriceVisibilityAnnouncement(
        `${persistenceTargetLabel}에 ${label} ${productCount}개 상품을 저장했습니다. ${refreshMessage}`,
      );
      return;
    }
    if (outcome.savedCount === 0) {
      setPriceVisibilityAnnouncement(
        `${persistenceTargetLabel}에 ${label} ${failedCount}개 상품 저장이 실패했습니다. ${refreshMessage}`,
      );
      return;
    }
    setPriceVisibilityAnnouncement(
      `${persistenceTargetLabel}에 ${label} ${outcome.savedCount}개 저장, ${failedCount}개 실패했습니다. ${refreshMessage}`,
    );
  };

  const persistAdminProducts = async (
    products: AdminProduct[],
    update: Partial<AdminProduct>,
    label: string,
  ): Promise<AdminProductSaveOutcome | null> => {
    if (products.length === 0) return null;
    const productIds = [...new Set(products.map((product) => product.id))];
    if (productIds.some((productId) => savingProductIdsRef.current.has(productId))) {
      setPriceVisibilityAnnouncement('저장 중인 상품이 있습니다. 작업 완료 후 다시 시도해 주세요.');
      return null;
    }
    const nextSavingProductIds = new Set(savingProductIdsRef.current);
    productIds.forEach((productId) => nextSavingProductIds.add(productId));
    savingProductIdsRef.current = nextSavingProductIds;
    setSavingProductIds(nextSavingProductIds);
    setPriceVisibilityAnnouncement(
      `${products.length.toLocaleString('ko-KR')}개 상품의 ${label} 설정을 저장하고 있습니다.`,
    );
    try {
      const outcome = await saveAdminProducts(products, update);
      announceProductSave(label, products.length, outcome);
      return outcome;
    } catch (saveError: unknown) {
      setPriceVisibilityAnnouncement(
        saveError instanceof Error ? saveError.message : `${label}을(를) 저장하지 못했습니다.`,
      );
      return null;
    } finally {
      const remainingSavingProductIds = new Set(savingProductIdsRef.current);
      productIds.forEach((productId) => remainingSavingProductIds.delete(productId));
      savingProductIdsRef.current = remainingSavingProductIds;
      setSavingProductIds(remainingSavingProductIds);
    }
  };

  const isProductPending = (productId: string) =>
    savingProductIds.has(productId) ||
    pendingHideProducts.some((product) => product.id === productId);
  const hasPendingSelectedProducts = selectedProducts.some((product) =>
    isProductPending(product.id),
  );

  const handleExposureChange = (product: AdminProduct, nextValue: boolean) => {
    void persistAdminProducts([product], { isVisible: nextValue }, '노출 상태');
  };
  const handleBulkShow = () => {
    if (selectedProducts.length === 0 || hasPendingSelectedProducts) return;
    void persistAdminProducts(selectedProducts, { priceVisible: true }, '금액 표시');
  };
  const handleOpenBulkHide = () => {
    if (selectedProducts.length === 0 || hasPendingSelectedProducts) return;
    setPendingHideProducts(selectedProducts);
  };
  const handleConfirmBulkHide = () => {
    if (pendingHideProducts.length === 0) return;
    void persistAdminProducts(pendingHideProducts, { priceVisible: false }, '금액 표시');
    setPendingHideProducts([]);
  };
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKeyword(searchText.trim());
    setPage(1);
    setSelectedIds([]);
  };
  const handleReset = () => {
    setSearchText('');
    setKeyword('');
    setCategoryId('');
    setSalesStatus('all');
    setPriceVisibility('all');
    setExposure('all');
    setTab('all');
    setPage(1);
    setSelectedIds([]);
    setPendingHideProducts([]);
  };
  const handleSelectPage = (checked: boolean) => {
    const pageIds = pageProducts
      .filter((product) => !isProductPending(product.id))
      .map((product) => product.id);
    setSelectedIds((previous) =>
      checked
        ? [...new Set([...previous, ...pageIds])]
        : previous.filter((productId) => !pageIds.includes(productId)),
    );
  };

  return (
    <section>
      <AdminPageHeader
        title="상품 관리"
        titleAdornment={
          <span className="text-caption text-text-3">
            총 {productQuery.data.totalCount.toLocaleString('ko-KR')}개
          </span>
        }
        description={`검색 조건 일치 상품 ${productQuery.data.products.length}개를 조회했습니다. 재고 상태, 판매 상태, 웹 노출, 금액 공개는 각각 별도 설정입니다.`}
        action={
          <Link to="/products/new" className={buttonClassName()}>
            상품 등록
          </Link>
        }
      />
      <AdminTabs
        label="상품 상태 필터"
        options={tabOptions}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab);
          setPage(1);
          setSelectedIds([]);
          setPendingHideProducts([]);
        }}
      />
      {productQuery.data.totalCount > productQuery.data.products.length ? (
        <AdminNotice tone="warning" className="mt-12">
          목록은 검색·카테고리 조건에 맞는 상품 중 첫 {productQuery.data.products.length}개만
          조회합니다. 상태 필터, 정렬, 페이지 이동은 이 조회 범위 안에서 적용됩니다.
        </AdminNotice>
      ) : null}
      <form
        className="mt-16 flex items-center gap-8 rounded-12 border border-line bg-bg p-12"
        onSubmit={handleSearch}
      >
        <label className="flex h-40 min-w-240 flex-1 items-center rounded-8 border border-line-control px-12">
          <span className="sr-only">상품명·브랜드 검색</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="상품명 · 브랜드 검색"
            className="w-full min-w-0 border-0 bg-transparent text-body-s outline-none placeholder:text-text-3"
          />
        </label>
        <label className="sr-only" htmlFor="admin-product-category">
          카테고리 필터
        </label>
        <select
          id="admin-product-category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
            setSelectedIds([]);
            setPendingHideProducts([]);
          }}
          className="h-40 w-160 rounded-8 border border-line-control bg-bg px-12 text-body-s"
        >
          <option value="">카테고리 전체</option>
          {productQuery.data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="admin-product-sales-status">
          판매 상태 필터
        </label>
        <select
          id="admin-product-sales-status"
          value={salesStatus}
          onChange={(event) => {
            setSalesStatus(event.target.value);
            setPage(1);
            setSelectedIds([]);
            setPendingHideProducts([]);
          }}
          className="h-40 w-144 rounded-8 border border-line-control bg-bg px-12 text-body-s"
        >
          <option value="all">판매 상태 전체</option>
          <option value="active">판매중</option>
          <option value="paused">판매 중지</option>
          <option value="ended">판매 종료</option>
        </select>
        <label className="sr-only" htmlFor="admin-product-price-visibility">
          금액 표시 필터
        </label>
        <select
          id="admin-product-price-visibility"
          value={priceVisibility}
          onChange={(event) => {
            setPriceVisibility(event.target.value);
            setPage(1);
            setSelectedIds([]);
            setPendingHideProducts([]);
          }}
          className="h-40 w-144 rounded-8 border border-line-control bg-bg px-12 text-body-s"
        >
          <option value="all">금액 표시 전체</option>
          <option value="visible">금액 표시</option>
          <option value="hidden">금액 미표시</option>
        </select>
        <label className="sr-only" htmlFor="admin-product-exposure">
          노출 필터
        </label>
        <select
          id="admin-product-exposure"
          value={exposure}
          onChange={(event) => {
            setExposure(event.target.value);
            setPage(1);
            setSelectedIds([]);
            setPendingHideProducts([]);
          }}
          className="h-40 w-144 rounded-8 border border-line-control bg-bg px-12 text-body-s"
        >
          <option value="all">노출 전체</option>
          <option value="visible">노출</option>
          <option value="hidden">숨김</option>
        </select>
        <Button type="button" variant="ghost" size="s" onClick={handleReset}>
          초기화
        </Button>
        <Button type="submit" size="s">
          검색
        </Button>
      </form>

      <section
        className="mt-16 overflow-hidden rounded-12 border border-line bg-bg"
        aria-label="상품 목록"
      >
        <div className="flex h-48 items-center justify-between gap-16 border-b border-line px-20">
          <p className="text-body-s text-text-2">
            검색 결과 {visibleProducts.length.toLocaleString('ko-KR')}개
          </p>
          <div className="flex items-center gap-8">
            <label className="sr-only" htmlFor="admin-product-sort">
              정렬 기준
            </label>
            <select
              id="admin-product-sort"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="h-36 rounded-8 border border-line-control bg-bg px-12 text-body-s"
            >
              <option value="recent">최근 등록순</option>
              <option value="oldest">오래된 순</option>
            </select>
            <label className="sr-only" htmlFor="admin-product-page-size">
              페이지당 표시 수
            </label>
            <select
              id="admin-product-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-36 rounded-8 border border-line-control bg-bg px-12 text-body-s"
            >
              <option value={10}>10개씩</option>
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
            </select>
          </div>
        </div>
        {selectedProducts.length > 0 ? (
          <section
            aria-label="선택 상품 작업"
            className="flex flex-wrap items-center justify-between gap-12 border-b border-text-1 bg-text-1 px-20 py-12 text-inverse"
          >
            <p className="text-label-m text-inverse">
              {selectedProducts.length.toLocaleString('ko-KR')}개 상품 선택
            </p>
            <div className="flex items-center gap-8">
              <Button
                variant="secondary"
                size="s"
                onClick={handleBulkShow}
                disabled={hasPendingSelectedProducts}
              >
                금액 표시
              </Button>
              <Button
                variant="secondary"
                size="s"
                onClick={handleOpenBulkHide}
                disabled={hasPendingSelectedProducts}
              >
                금액 미표시
              </Button>
              <Button
                variant="ghost"
                size="s"
                className="text-inverse hover:bg-bg/10 active:bg-bg/10"
                onClick={() => setSelectedIds([])}
              >
                선택 해제
              </Button>
            </div>
          </section>
        ) : null}
        <p role="status" aria-live="polite" className="sr-only">
          {priceVisibilityAnnouncement}
        </p>
        {pageProducts.length === 0 ? (
          <AdminEmpty
            title="검색 결과가 없습니다"
            description="검색어나 필터 조건을 확인해 주세요."
          />
        ) : (
          <>
            <p className="mb-8 text-caption text-text-3">
              표가 넓으면 가로로 이동할 수 있습니다. 작업 열은 스크롤 중에도 오른쪽에 고정됩니다.
            </p>
            <div role="region" aria-label="상품 목록 가로 스크롤 표" className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed border-collapse text-left text-body-s">
                <thead className="bg-surface text-label-s text-text-2">
                  <tr>
                    <th scope="col" className="w-40 px-4 py-12">
                      <input
                        type="checkbox"
                        aria-label="현재 페이지 전체 선택"
                        checked={
                          pageProducts.length > 0 &&
                          pageProducts
                            .filter((product) => !isProductPending(product.id))
                            .every((product) => selectedIds.includes(product.id))
                        }
                        onChange={(event) => handleSelectPage(event.target.checked)}
                        disabled={pageProducts.every((product) => isProductPending(product.id))}
                        className="size-20 accent-text-1"
                      />
                    </th>
                    <th scope="col" className="w-48 px-4 py-12 font-medium">
                      이미지
                    </th>
                    <th scope="col" className="w-136 px-6 py-12 font-medium">
                      상품명 / 코드
                    </th>
                    <th scope="col" className="w-96 px-6 py-12 font-medium">
                      카테고리
                    </th>
                    <th scope="col" className="w-120 px-6 py-12 text-right font-medium">
                      판매가
                    </th>
                    <th scope="col" className="w-100 px-6 py-12 font-medium">
                      금액 표시
                    </th>
                    <th scope="col" className="w-100 px-6 py-12 font-medium">
                      상품 노출
                    </th>
                    <th scope="col" className="w-60 px-6 py-12 font-medium">
                      재고 수량
                    </th>
                    <th scope="col" className="w-72 px-6 py-12 font-medium">
                      재고 상태
                    </th>
                    <th scope="col" className="w-112 px-6 py-12 font-medium">
                      등록일
                    </th>
                    <th
                      scope="col"
                      className="sticky right-0 z-20 w-96 bg-surface px-6 py-12 font-medium shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]"
                    >
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageProducts.map((product) => {
                    const isPriceVisible = product.priceVisible;
                    const isProductExposed = product.isVisible ?? true;
                    const isProductSaving = isProductPending(product.id);
                    return (
                      <tr
                        key={product.id}
                        className="group border-t border-line hover:bg-bg-subtle"
                      >
                        <td className="px-8 py-6">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(product.id)}
                            aria-label={product.name + ' 선택'}
                            disabled={isProductSaving}
                            onChange={(event) =>
                              setSelectedIds((previous) =>
                                event.target.checked
                                  ? [...previous, product.id]
                                  : previous.filter((productId) => productId !== product.id),
                              )
                            }
                            className="size-20 accent-text-1"
                          />
                        </td>
                        <td className="px-4 py-6">
                          <div className="size-40 overflow-hidden rounded-6 bg-surface-2">
                            {product.thumbnailUrl ? (
                              <img
                                src={product.thumbnailUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="sr-only">이미지 없음</span>
                            )}
                          </div>
                        </td>
                        <td className="max-w-160 px-8 py-6">
                          <Link
                            to={'/products/' + product.id}
                            aria-disabled={isProductSaving || undefined}
                            onClick={(event) => {
                              if (isProductSaving) event.preventDefault();
                            }}
                            className={`block truncate font-medium hover:underline ${isProductSaving ? 'pointer-events-none text-text-disabled' : ''}`}
                            title={product.name}
                          >
                            {product.name}
                          </Link>
                          <span
                            className="mt-2 block truncate text-caption text-text-3"
                            title={product.id}
                          >
                            {product.id}
                          </span>
                        </td>
                        <td
                          className="max-w-120 truncate px-8 py-6 text-text-2"
                          title={categoryPath(product.categoryId, productQuery.data.categories)}
                        >
                          {categoryPath(product.categoryId, productQuery.data.categories)}
                        </td>
                        <td className="px-8 py-6 text-right whitespace-nowrap">
                          {product.price === null
                            ? '실제 금액 미제공'
                            : formatAdminCurrency(product.price)}
                        </td>
                        <td className="px-8 py-6 text-body-s text-text-2">
                          <Switch
                            label={`${product.name} 금액 표시`}
                            isChecked={isPriceVisible}
                            isPending={isProductSaving}
                            onCheckedChange={(nextValue) => {
                              void persistAdminProducts(
                                [product],
                                { priceVisible: nextValue },
                                '금액 표시',
                              );
                            }}
                            onText="표시"
                            offText="미표시"
                          />
                        </td>
                        <td className="px-8 py-6 text-body-s text-text-2">
                          <Switch
                            label={`${product.name} 상품 노출`}
                            isChecked={isProductExposed}
                            isPending={isProductSaving}
                            onCheckedChange={(nextValue) =>
                              handleExposureChange(product, nextValue)
                            }
                            onText="노출"
                            offText="숨김"
                          />
                        </td>
                        <td className="px-8 py-6 text-text-3">미제공</td>
                        <td className="px-8 py-6">
                          <AdminStatusBadge status={product.stockStatus} kind="product" />
                        </td>
                        <td className="w-112 px-6 py-6 whitespace-nowrap text-text-3">
                          {formatAdminDate(product.createdAt)}
                        </td>
                        <td className="sticky right-0 z-10 bg-bg px-8 py-6 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)] group-hover:bg-bg-subtle">
                          <details className="relative">
                            <summary
                              aria-disabled={isProductSaving || undefined}
                              tabIndex={isProductSaving ? -1 : 0}
                              onClick={(event) => {
                                if (isProductSaving) event.preventDefault();
                              }}
                              className={`list-none rounded-6 border border-line-control px-10 py-6 text-caption focus-ring ${isProductSaving ? 'cursor-not-allowed text-text-disabled' : 'cursor-pointer'}`}
                            >
                              작업
                            </summary>
                            <div className="shadow-lg absolute right-0 z-10 mt-4 grid min-w-144 gap-2 rounded-8 border border-line bg-bg p-6">
                              <button
                                type="button"
                                disabled={isProductSaving}
                                className="rounded-4 px-8 py-6 text-left text-caption focus-ring hover:bg-surface"
                                onClick={() => {
                                  void persistAdminProducts(
                                    [product],
                                    { stockStatus: 'inStock' },
                                    '재고 상태',
                                  ).then((outcome) => {
                                    if (!outcome || outcome.savedCount === 0) return;
                                    setStockStatusOverrides((previous) => ({
                                      ...previous,
                                      [product.id]: 'inStock',
                                    }));
                                  });
                                }}
                              >
                                재고 있음으로 설정
                              </button>
                              <button
                                type="button"
                                disabled={isProductSaving}
                                className="rounded-4 px-8 py-6 text-left text-caption focus-ring hover:bg-surface"
                                onClick={() => {
                                  void persistAdminProducts(
                                    [product],
                                    { stockStatus: 'soldOut' },
                                    '재고 상태',
                                  ).then((outcome) => {
                                    if (!outcome || outcome.savedCount === 0) return;
                                    setStockStatusOverrides((previous) => ({
                                      ...previous,
                                      [product.id]: 'soldOut',
                                    }));
                                  });
                                }}
                              >
                                재고 없음으로 설정
                              </button>
                              <button
                                type="button"
                                disabled={isProductSaving}
                                className="rounded-4 px-8 py-6 text-left text-caption focus-ring hover:bg-surface"
                                onClick={() =>
                                  void persistAdminProducts(
                                    [product],
                                    { salesStatus: 'active' },
                                    '판매 상태',
                                  )
                                }
                              >
                                판매 재개
                              </button>
                              <button
                                type="button"
                                disabled={isProductSaving}
                                className="rounded-4 px-8 py-6 text-left text-caption focus-ring hover:bg-surface"
                                onClick={() =>
                                  void persistAdminProducts(
                                    [product],
                                    { salesStatus: 'paused' },
                                    '판매 상태',
                                  )
                                }
                              >
                                판매 일시중지
                              </button>
                              <button
                                type="button"
                                disabled={isProductSaving}
                                className="rounded-4 px-8 py-6 text-left text-caption text-danger focus-ring hover:bg-surface"
                                onClick={() => setDeleteTarget(product)}
                              >
                                상품 삭제
                              </button>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        className="mt-20 flex justify-center"
      />
      <PriceVisibilityConfirmDialog
        isOpen={pendingHideProducts.length > 0}
        selectedProducts={pendingHideProducts}
        persistenceTargetLabel={persistenceTargetLabel}
        onCancel={() => setPendingHideProducts([])}
        onConfirm={handleConfirmBulkHide}
      />
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        title="상품을 삭제하시겠습니까?"
        description={
          deleteTarget ? `${deleteTarget.name} 상품을 목 API 목록에서 삭제합니다.` : undefined
        }
        tone="danger"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError('');
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const api = await getShopApi();
                  await api.products.deleteAdmin(deleteTarget.id);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
                    queryClient.invalidateQueries({ queryKey: ['products'] }),
                    queryClient.invalidateQueries({ queryKey: ['home', 'content'] }),
                  ]);
                  setDeleteTarget(null);
                  setDeleteError('');
                } catch (deleteFailure) {
                  setDeleteError(
                    deleteFailure instanceof Error
                      ? deleteFailure.message
                      : '상품을 삭제하지 못했습니다.',
                  );
                }
              }}
            >
              삭제
            </Button>
          </>
        }
      >
        {deleteError ? (
          <p role="alert" className="mt-12 text-body-s text-danger">
            {deleteError}
          </p>
        ) : null}
      </Modal>
    </section>
  );
}
