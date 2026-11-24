import { ApiError } from '@eum/api/errors';
import type { ProductListParams } from '@eum/api/shop-api';
import type { PagedResult, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PagedProductCollectionView,
  RecommendedProductCollectionView,
} from './product-collection-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listProducts: vi.fn(),
  listRecommended: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
vi.mock('@/lib/use-media-query', () => ({
  getScrollBehavior: () => 'auto',
  usePrefersReducedMotion: () => true,
}));
// 카드 자체의 장바구니·찜 동작은 product-card 테스트가 맡고, 여기서는 상품 항목 수와 이름만 봅니다.
vi.mock('./product-card', () => ({
  ProductCard: ({ product }: { product: Product }) => <p>{product.name}</p>,
}));

function createProduct(id: number): Product {
  return {
    id: 'prd-' + id,
    name: '테스트 상품 ' + id,
    brand: '테스트 브랜드',
    categoryId: 'cat-test',
    price: 10000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '',
    modelName: null,
    images: [],
    options: [],
    specifications: [],
    certifications: [],
    shipping: {
      method: '일반 배송',
      estimate: '2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: '',
    },
    purchaseNotices: [],
    rating: null,
    reviewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    isFeatured: true,
  };
}

function createPagedResult(products: Product[], totalCount: number): PagedResult<Product> {
  return { items: products, page: 1, pageSize: 24, totalCount };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** 목록 조회 호출에서 마지막으로 전달된 매개변수를 읽습니다. */
function lastListParams(): ProductListParams | undefined {
  const lastCall = apiMocks.listProducts.mock.calls.at(-1);
  return lastCall ? (lastCall[0] as ProductListParams) : undefined;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  apiMocks.listProducts.mockReset();
  apiMocks.listRecommended.mockReset();
  apiMocks.getShopApi.mockResolvedValue({
    products: { list: apiMocks.listProducts, listRecommended: apiMocks.listRecommended },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PagedProductCollectionView (베스트·할인 상품)', () => {
  it('shows only the title, product grid and pagination for best sellers', async () => {
    apiMocks.listProducts.mockResolvedValue(
      createPagedResult([createProduct(1), createProduct(2)], 2),
    );

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('heading', { level: 1, name: '베스트 셀러' })).toBeInTheDocument();
    const grid = await screen.findByRole('list');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2);
    expect(lastListParams()).toEqual({ collection: 'featured', page: 1, pageSize: 24 });

    // 필터·정렬·보기 방식·총 개수·브레드크럼 없음
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('group', { name: '보기 방식' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: '브레드크럼' })).toBeNull();
    expect(screen.queryByText(/총 .*개/)).toBeNull();
  });

  it('shows discounted products without filter controls and requests the discounted collection', async () => {
    apiMocks.listProducts.mockResolvedValue(createPagedResult([createProduct(12)], 1));

    render(
      <PagedProductCollectionView
        title="할인 상품"
        collection="discounted"
        emptyTitle="등록된 할인 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText('테스트 상품 12')).toBeInTheDocument();
    expect(lastListParams()).toEqual({ collection: 'discounted', page: 1, pageSize: 24 });
    expect(screen.queryByRole('group', { name: /필터|정렬/ })).toBeNull();
  });

  it('keeps pagination and requests the next page when a page button is pressed', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockResolvedValue(createPagedResult([createProduct(1)], 30));

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));

    await waitFor(() =>
      expect(lastListParams()).toEqual({ collection: 'featured', page: 2, pageSize: 24 }),
    );
  });

  it('shows the empty state title when the collection has no products', async () => {
    apiMocks.listProducts.mockResolvedValue(createPagedResult([], 0));

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText('등록된 베스트 상품이 없습니다')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('link', { name: '전체 상품 보기' })).toHaveAttribute('href', '/search');
  });

  it('shows a loading skeleton while the first request is pending', () => {
    apiMocks.listProducts.mockReturnValue(new Promise<PagedResult<Product>>(() => undefined));

    const { container } = render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the error notice with a retry button when the first request fails', async () => {
    apiMocks.listProducts.mockRejectedValue(new ApiError('NETWORK', 'offline'));

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    // 첫 페이지에서 실패했으면 첫 페이지로 버튼은 필요 없습니다.
    expect(screen.queryByRole('button', { name: '첫 페이지로' })).toBeNull();
  });

  it('shows the preparing message when the API reports the feature is not implemented', async () => {
    apiMocks.listProducts.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'not yet'));

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '상품 조회 기능을 준비하고 있습니다.',
    );
  });

  it('keeps pagination and offers retry when a later page request fails', async () => {
    const user = userEvent.setup();
    let isSecondPageFailing = true;
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) => {
      if (params.page === 2 && isSecondPageFailing) throw new ApiError('NETWORK', 'offline');
      return createPagedResult([createProduct(params.page ?? 1)], 30);
    });

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // 오류 중에도 페이지 이동이 사라지지 않아야 합니다(마지막으로 확인한 페이지 수를 유지).
    const pageNavigation = screen.getByRole('navigation', { name: '페이지 이동' });
    expect(within(pageNavigation).getByRole('button', { name: '1페이지' })).toBeInTheDocument();

    const requestsForSecondPageBeforeRetry = apiMocks.listProducts.mock.calls.filter(
      ([params]) => params.page === 2,
    ).length;
    isSecondPageFailing = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('테스트 상품 2')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    // 다시 시도는 같은 2페이지 요청을 새로 보냅니다.
    const requestsForSecondPageAfterRetry = apiMocks.listProducts.mock.calls.filter(
      ([params]) => params.page === 2,
    ).length;
    expect(requestsForSecondPageAfterRetry).toBeGreaterThan(requestsForSecondPageBeforeRetry);
  });

  it('returns to the first page from a failed later page', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) => {
      if (params.page === 2) throw new ApiError('NETWORK', 'offline');
      return createPagedResult([createProduct(1)], 30);
    });

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));
    await user.click(await screen.findByRole('button', { name: '첫 페이지로' }));

    await waitFor(() =>
      expect(lastListParams()).toEqual({ collection: 'featured', page: 1, pageSize: 24 }),
    );
    expect(await screen.findByText('테스트 상품 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps focus in the results region while a retry reloads the failed page', async () => {
    const user = userEvent.setup();
    let secondPageMode: 'fail' | 'hang' = 'fail';
    let releaseSecondPage: () => void = () => undefined;
    apiMocks.listProducts.mockImplementation((params: ProductListParams) => {
      if (params.page !== 2) return Promise.resolve(createPagedResult([createProduct(1)], 30));
      if (secondPageMode === 'fail') return Promise.reject(new ApiError('NETWORK', 'offline'));
      return new Promise<PagedResult<Product>>((resolve) => {
        releaseSecondPage = () => resolve(createPagedResult([createProduct(2)], 30));
      });
    });

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));
    await screen.findByRole('alert');

    secondPageMode = 'hang';
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    // 재시도 중에는 오류 블록이 스켈레톤으로 바뀌지만, 포커스는 버튼이 아니라 남아 있는 결과 영역에 있어야 합니다.
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    const resultsRegion = screen.getByRole('region', { name: '상품 목록' });
    expect(document.activeElement).toBe(resultsRegion);

    // 키보드 포커스 링은 focus-visible 기준 유틸리티로 보이고, 포커스 유지 대상에 outline-none을 쓰지 않습니다.
    expect(resultsRegion).toHaveClass('focus-ring');
    expect(resultsRegion).not.toHaveClass('outline-none');

    releaseSecondPage();
    expect(await screen.findByText('테스트 상품 2')).toBeInTheDocument();
    expect(document.activeElement).toBe(resultsRegion);
  });

  it('keeps focus in the results region when the first-page button is pressed', async () => {
    const user = userEvent.setup();
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) => {
      if (params.page === 2) throw new ApiError('NETWORK', 'offline');
      return createPagedResult([createProduct(1)], 30);
    });

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));
    await user.click(await screen.findByRole('button', { name: '첫 페이지로' }));

    // 첫 페이지로 버튼은 이 클릭으로 사라지므로, 포커스는 결과 영역에 있어야 합니다.
    expect(await screen.findByText('테스트 상품 1')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole('region', { name: '상품 목록' }));
    // 포커스 이동이 목록을 위로 튀게 하지 않도록 preventScroll을 씁니다.
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  // 처음부터 비정상 totalCount이면 확인된 페이지 수가 없으므로 초기값인 1페이지만 보입니다.
  it.each([
    ['NaN', Number.NaN],
    ['undefined', undefined],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])(
    'shows one page when the first response has a non-finite totalCount (%s)',
    async (_label, totalCount) => {
      apiMocks.listProducts.mockResolvedValue({
        items: [createProduct(1)],
        page: 1,
        pageSize: 24,
        totalCount,
      } as unknown as PagedResult<Product>);

      render(
        <PagedProductCollectionView
          title="베스트 셀러"
          collection="featured"
          emptyTitle="등록된 베스트 상품이 없습니다"
        />,
        { wrapper: createWrapper() },
      );

      expect(await screen.findByText('테스트 상품 1')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: '페이지 이동' })).toBeNull();
    },
  );

  it('keeps the last known page count when a later response has a non-finite totalCount', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) =>
      params.page === 2
        ? ({
            items: [createProduct(2)],
            page: 2,
            pageSize: 24,
            totalCount: Number.NaN,
          } as PagedResult<Product>)
        : createPagedResult([createProduct(1)], 30),
    );

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));

    expect(await screen.findByText('테스트 상품 2')).toBeInTheDocument();
    // 직전에 확인한 2페이지 수가 유지되어 페이지 이동이 남고, 2페이지가 1페이지로 되돌아가지 않습니다.
    const pageNavigation = screen.getByRole('navigation', { name: '페이지 이동' });
    expect(within(pageNavigation).getByRole('button', { name: '2페이지' })).toBeInTheDocument();
    expect(lastListParams()).toEqual({ collection: 'featured', page: 2, pageSize: 24 });
  });

  it('stays on page 2 when the page 2 response is within range', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) =>
      createPagedResult([createProduct(params.page ?? 1)], 30),
    );

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));

    expect(await screen.findByText('테스트 상품 2')).toBeInTheDocument();
    expect(screen.queryByText('테스트 상품 1')).toBeNull();
    expect(lastListParams()).toEqual({ collection: 'featured', page: 2, pageSize: 24 });
  });

  it('shows the empty state for a non-finite totalCount without looping', async () => {
    apiMocks.listProducts.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 24,
      totalCount: Number.NaN,
    } as PagedResult<Product>);

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText('등록된 베스트 상품이 없습니다')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '페이지 이동' })).toBeNull();
  });

  it('returns to the first page when the list shrinks past the current page', async () => {
    const user = userEvent.setup();
    let totalCount = 30;
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) =>
      params.page === 2
        ? createPagedResult([], totalCount)
        : createPagedResult([createProduct(1)], totalCount),
    );

    render(
      <PagedProductCollectionView
        title="베스트 셀러"
        collection="featured"
        emptyTitle="등록된 베스트 상품이 없습니다"
      />,
      { wrapper: createWrapper() },
    );

    const pagination = await screen.findByRole('navigation', { name: '페이지 이동' });
    // 2페이지를 받을 때 전체 개수가 줄어 2페이지가 범위를 벗어난 상황입니다.
    totalCount = 10;
    await user.click(within(pagination).getByRole('button', { name: '2페이지' }));

    await waitFor(() =>
      expect(lastListParams()).toEqual({ collection: 'featured', page: 1, pageSize: 24 }),
    );
    expect(await screen.findByText('테스트 상품 1')).toBeInTheDocument();
    expect(screen.queryByText('등록된 베스트 상품이 없습니다')).toBeNull();
  });
});

describe('RecommendedProductCollectionView (추천상품)', () => {
  it('shows the preparing message when the recommended API is not implemented', async () => {
    apiMocks.listRecommended.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'not yet'));

    render(
      <RecommendedProductCollectionView title="추천 상품" emptyTitle="추천 상품이 없습니다" />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '상품 조회 기능을 준비하고 있습니다.',
    );
    // 추천 화면은 페이지 이동이 없으므로 재시도 버튼도 두지 않습니다.
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
  });

  it('requests a fixed 48 items, shows no pagination or filters', async () => {
    apiMocks.listRecommended.mockResolvedValue([createProduct(1), createProduct(2)]);

    render(
      <RecommendedProductCollectionView title="추천 상품" emptyTitle="추천 상품이 없습니다" />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(screen.getByRole('heading', { level: 1, name: '추천 상품' })).toBeInTheDocument();
    const grid = await screen.findByRole('list');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2);
    expect(apiMocks.listRecommended).toHaveBeenCalledWith({ limit: 48 }, expect.anything());

    expect(screen.queryByRole('navigation', { name: '페이지 이동' })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the empty state title when no recommended products are returned', async () => {
    apiMocks.listRecommended.mockResolvedValue([]);

    render(
      <RecommendedProductCollectionView title="추천 상품" emptyTitle="추천 상품이 없습니다" />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(await screen.findByText('추천 상품이 없습니다')).toBeInTheDocument();
  });

  it('shows the error notice when the recommended request fails', async () => {
    apiMocks.listRecommended.mockRejectedValue(new ApiError('NETWORK', 'offline'));

    render(
      <RecommendedProductCollectionView title="추천 상품" emptyTitle="추천 상품이 없습니다" />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });
});
