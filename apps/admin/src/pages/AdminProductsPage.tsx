import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Pagination } from '@eum/ui/components/Pagination';
import { Switch } from '@eum/ui/components/Switch';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import {
  useAdminPriceVisibilityPreview,
  type PriceVisibilityPreviewSnapshot,
} from '@/lib/admin-price-visibility-preview';
import { getShopApi } from '@/lib/shop-api';
import type { Category, Product } from '@eum/api/types';

type ProductTab = 'all' | 'selling' | 'soldOut' | 'hiddenPrice';
interface ProductListData {
  products: Product[];
  categories: Category[];
  totalCount: number;
}

const PRODUCT_TABS = [
  { value: 'all', label: '전체' },
  { value: 'selling', label: '판매중' },
  { value: 'soldOut', label: '품절' },
  { value: 'hiddenPrice', label: '금액 미표시' },
] as const satisfies readonly { value: ProductTab; label: string }[];

/** 목록 조회 API 결과에서 필요한 상품과 카테고리를 함께 불러옵니다. */
async function loadProducts(
  keyword: string,
  categoryId: string,
  signal: AbortSignal,
): Promise<ProductListData> {
  const api = await getShopApi();
  const [productPage, categories] = await Promise.all([
    api.products.list(
      {
        keyword: keyword || undefined,
        categoryId: categoryId || undefined,
        page: 1,
        pageSize: 100,
      },
      { signal },
    ),
    api.categories.list({ signal }),
  ]);
  return { products: productPage.items, categories, totalCount: productPage.totalCount };
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

/** Admin 상품 목록과 상품 금액 표시의 세션 내 미리보기를 제공합니다. */
export function AdminProductsPage() {
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [salesStatus, setSalesStatus] = useState('all');
  const [tab, setTab] = useState<ProductTab>('all');
  const [sortOrder, setSortOrder] = useState('recent');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stockStatusOverrides, setStockStatusOverrides] = useState<
    Partial<Record<string, Product['stockStatus']>>
  >({});
  const [pendingHideProducts, setPendingHideProducts] = useState<Product[]>([]);
  const [priceVisibilityAnnouncement, setPriceVisibilityAnnouncement] = useState('');
  const [undoAction, setUndoAction] = useState<{
    message: string;
    snapshots: PriceVisibilityPreviewSnapshot[];
  } | null>(null);
  const {
    capturePreviewValues,
    getPreviewValue,
    hasPreviewChanges,
    restorePreviewValues,
    setPreviewValue,
  } = useAdminPriceVisibilityPreview();
  const productQuery = useQuery({
    queryKey: ['admin', 'products', keyword, categoryId],
    queryFn: ({ signal }) => loadProducts(keyword, categoryId, signal),
  });

  useEffect(() => {
    if (!undoAction) return;
    const timeoutId = window.setTimeout(() => setUndoAction(null), 7000);
    return () => window.clearTimeout(timeoutId);
  }, [undoAction]);

  const visibleProducts = useMemo(() => {
    if (!productQuery.data) return [];
    return productQuery.data.products
      .map((product) => ({
        ...product,
        stockStatus: stockStatusOverrides[product.id] ?? product.stockStatus,
      }))
      .filter((product) => {
        if (tab === 'selling') return product.stockStatus === 'inStock';
        if (tab === 'soldOut') return product.stockStatus === 'soldOut';
        if (tab === 'hiddenPrice') return !getPreviewValue(product);
        return true;
      })
      .filter((product) => salesStatus === 'all' || product.stockStatus === salesStatus)
      .toSorted((left, right) =>
        sortOrder === 'oldest'
          ? left.createdAt.localeCompare(right.createdAt)
          : right.createdAt.localeCompare(left.createdAt),
      );
  }, [getPreviewValue, productQuery.data, salesStatus, sortOrder, stockStatusOverrides, tab]);
  const allFilteredProducts = useMemo(() => {
    if (!productQuery.data) return [];
    return productQuery.data.products
      .map((product) => ({
        ...product,
        stockStatus: stockStatusOverrides[product.id] ?? product.stockStatus,
      }))
      .filter((product) => salesStatus === 'all' || product.stockStatus === salesStatus);
  }, [productQuery.data, salesStatus, stockStatusOverrides]);

  if (productQuery.isPending) return <AdminLoading label="상품 목록을 불러오고 있습니다." />;
  if (productQuery.isError) return <AdminError onRetry={() => void productQuery.refetch()} />;

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = visibleProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedProducts = visibleProducts.filter((product) => selectedIds.includes(product.id));
  const tabOptions = PRODUCT_TABS.map((option) => ({
    ...option,
    count: allFilteredProducts.filter((product) => {
      const currentStatus = stockStatusOverrides[product.id] ?? product.stockStatus;
      if (option.value === 'selling') return currentStatus === 'inStock';
      if (option.value === 'soldOut') return currentStatus === 'soldOut';
      if (option.value === 'hiddenPrice') return !getPreviewValue(product);
      return true;
    }).length,
  }));
  const handleBulkShow = () => {
    if (selectedProducts.length === 0) return;
    const snapshots = capturePreviewValues(selectedProducts);
    setPreviewValue(selectedProducts, true);
    const message = `${selectedProducts.length.toLocaleString('ko-KR')}개 상품의 금액 표시를 켜서 현재 관리자 화면에서 미리봅니다.`;
    setPriceVisibilityAnnouncement(message);
    setUndoAction({ message, snapshots });
  };
  const handleOpenBulkHide = () => {
    if (selectedProducts.length === 0) return;
    setPendingHideProducts(selectedProducts);
  };
  const handleConfirmBulkHide = () => {
    if (pendingHideProducts.length === 0) return;
    const snapshots = capturePreviewValues(pendingHideProducts);
    setPreviewValue(pendingHideProducts, false);
    const message = `${pendingHideProducts.length.toLocaleString('ko-KR')}개 상품의 금액 표시를 꺼서 현재 관리자 화면에서 미리봅니다.`;
    setPriceVisibilityAnnouncement(message);
    setUndoAction({ message, snapshots });
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
    setTab('all');
    setPage(1);
    setSelectedIds([]);
    setPendingHideProducts([]);
  };
  const handleSelectPage = (checked: boolean) => {
    const pageIds = pageProducts.map((product) => product.id);
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
        description={`검색 조건 일치 ${productQuery.data.totalCount.toLocaleString('ko-KR')}개 · ${productQuery.data.products.length}개 조회`}
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
      {Object.keys(stockStatusOverrides).length > 0 ? (
        <AdminNotice tone="warning" className="mt-12">
          판매 상태 변경은 현재 화면의 임시 미리보기입니다. 서버에 저장되지 않으며 페이지를
          새로고침하면 사라집니다.
        </AdminNotice>
      ) : null}
      {hasPreviewChanges ? (
        <AdminNotice tone="info" className="mt-12">
          금액 표시 변경은 현재 관리자 화면에서만 미리보기로 유지됩니다. 서버에 저장되지 않으며
          구매자 화면·장바구니·주문에는 반영되지 않습니다. 새로고침 또는 로그아웃하면 초기화됩니다.
        </AdminNotice>
      ) : null}
      {undoAction ? (
        <AdminNotice
          className="mt-12"
          tone="info"
          action={
            <Button
              type="button"
              variant="secondary"
              size="s"
              onClick={() => {
                restorePreviewValues(undoAction.snapshots);
                setPriceVisibilityAnnouncement('금액 표시를 변경 전 미리보기 값으로 되돌렸습니다.');
                setUndoAction(null);
              }}
            >
              되돌리기
            </Button>
          }
        >
          {undoAction.message}
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
        <label className="sr-only" htmlFor="admin-product-status">
          판매 상태 필터
        </label>
        <select
          id="admin-product-status"
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
          <option value="inStock">판매중</option>
          <option value="soldOut">품절</option>
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
              <Button variant="secondary" size="s" onClick={handleBulkShow}>
                금액 표시
              </Button>
              <Button variant="secondary" size="s" onClick={handleOpenBulkHide}>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-body-s">
              <thead className="bg-surface text-label-s text-text-2">
                <tr>
                  <th scope="col" className="w-52 px-8 py-12">
                    <input
                      type="checkbox"
                      aria-label="현재 페이지 전체 선택"
                      checked={
                        pageProducts.length > 0 &&
                        pageProducts.every((product) => selectedIds.includes(product.id))
                      }
                      onChange={(event) => handleSelectPage(event.target.checked)}
                      className="size-20 accent-text-1"
                    />
                  </th>
                  <th scope="col" className="w-64 px-4 py-12 font-medium">
                    이미지
                  </th>
                  <th scope="col" className="w-160 px-8 py-12 font-medium">
                    상품명 / 코드
                  </th>
                  <th scope="col" className="w-120 px-8 py-12 font-medium">
                    카테고리
                  </th>
                  <th scope="col" className="w-144 px-8 py-12 text-right font-medium">
                    판매가
                  </th>
                  <th scope="col" className="w-112 px-8 py-12 font-medium">
                    금액 표시
                  </th>
                  <th scope="col" className="w-76 px-8 py-12 font-medium">
                    재고 수량
                  </th>
                  <th scope="col" className="w-80 px-8 py-12 font-medium">
                    재고 상태
                  </th>
                  <th scope="col" className="w-96 px-8 py-12 font-medium">
                    등록일
                  </th>
                  <th scope="col" className="w-96 px-8 py-12 font-medium">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageProducts.map((product) => {
                  const isPriceVisible = getPreviewValue(product);
                  return (
                    <tr key={product.id} className="border-t border-line hover:bg-bg-subtle">
                      <td className="px-8 py-6">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          aria-label={product.name + ' 선택'}
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
                          className="block truncate font-medium hover:underline"
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
                          onCheckedChange={(nextValue) => setPreviewValue([product], nextValue)}
                          onText="표시"
                          offText="미표시"
                        />
                      </td>
                      <td className="px-8 py-6 text-text-3">미제공</td>
                      <td className="px-8 py-6">
                        <AdminStatusBadge status={product.stockStatus} kind="product" />
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap text-text-3">
                        {formatAdminDate(product.createdAt)}
                      </td>
                      <td className="px-8 py-6">
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-6 border border-line-control px-10 py-6 text-caption focus-ring">
                            작업
                          </summary>
                          <div className="shadow-lg absolute right-0 z-10 mt-4 grid min-w-144 gap-2 rounded-8 border border-line bg-bg p-6">
                            <button
                              type="button"
                              className="rounded-4 px-8 py-6 text-left text-caption focus-ring hover:bg-surface"
                              onClick={() =>
                                setStockStatusOverrides((previous) => ({
                                  ...previous,
                                  [product.id]: 'inStock',
                                }))
                              }
                            >
                              판매중으로 미리보기
                            </button>
                            <button
                              type="button"
                              className="rounded-4 px-8 py-6 text-left text-caption focus-ring hover:bg-surface"
                              onClick={() =>
                                setStockStatusOverrides((previous) => ({
                                  ...previous,
                                  [product.id]: 'soldOut',
                                }))
                              }
                            >
                              품절로 미리보기
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
        onCancel={() => setPendingHideProducts([])}
        onConfirm={handleConfirmBulkHide}
      />
    </section>
  );
}
