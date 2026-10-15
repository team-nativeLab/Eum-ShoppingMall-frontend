import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProductListParams } from '@eum/api/shop-api';
import type { PagedResult, Product } from '@eum/api/types';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductListingView } from './product-listing-view';

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
);

const navigationMocks = vi.hoisted(() => ({
  pathname: '/search',
  push: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  listFacets: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({ push: navigationMocks.push }),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

vi.mock('@/lib/use-media-query', () => ({
  getScrollBehavior: () => 'auto',
  usePrefersReducedMotion: () => true,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ProductListingView brand navigation', () => {
  beforeEach(() => {
    navigationMocks.pathname = '/search';
    navigationMocks.push.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      products: { list: apiMocks.listProducts, facets: apiMocks.listFacets },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.listProducts.mockResolvedValue({ items: [], page: 1, pageSize: 24, totalCount: 0 });
    apiMocks.listCategories.mockResolvedValue([]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 0,
      keywordTotalCount: 10,
      categories: [],
      brands: [
        { value: '3M', count: 4 },
        { value: '동아', count: 2 },
      ],
      certifications: [],
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media: string) => ({
        matches: media.includes('max-width'),
        media,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalScrollIntoViewDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollIntoView',
        originalScrollIntoViewDescriptor,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('restores the selected brand from route state and opens the mobile brand group', async () => {
    render(
      <ProductListingView initialKeyword="glove" initialBrands={['3M']} initialBrowseBrands />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('button', { name: '필터' })).toHaveAttribute('aria-expanded', 'true');
    const brandHeading = screen.getByRole('heading', { name: '브랜드', level: 2 });
    expect(brandHeading).toBeVisible();
    const brandGroup = screen.getByRole('group', { name: '브랜드' });
    expect(brandGroup).toHaveAttribute('aria-labelledby', brandHeading.id);
    expect(brandGroup).not.toHaveClass('focus-visible:outline-2');
    const selectedBrandChip = await within(brandGroup).findByRole('button', { name: '3M' });
    expect(selectedBrandChip).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(selectedBrandChip).toHaveFocus());
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'nearest',
    });
  });

  it('moves focus into the brand chips when retrying mobile brand browsing succeeds', async () => {
    const user = userEvent.setup();
    apiMocks.listFacets
      .mockRejectedValueOnce(new Error('temporary facet failure'))
      .mockResolvedValueOnce({
        totalCount: 0,
        keywordTotalCount: 10,
        categories: [],
        brands: [{ value: '3M', count: 4 }],
        certifications: [],
      });

    render(<ProductListingView initialBrowseBrands />, { wrapper: createWrapper() });

    const [retryButton] = await screen.findAllByRole('button', { name: '다시 시도' });
    if (!retryButton) throw new Error('모바일 필터 재시도 버튼을 찾을 수 없습니다.');
    const brandGroup = screen.getByRole('group', { name: '브랜드' });
    await waitFor(() => expect(brandGroup).toHaveFocus());

    retryButton.focus();
    await user.keyboard('{Enter}');

    const brandChip = await within(brandGroup).findByRole('button', { name: '3M' });
    await waitFor(() => expect(brandChip).toHaveFocus());
  });

  it('pushes a brand selection into the URL without dropping the query or browse intent', async () => {
    const user = userEvent.setup();
    render(
      <ProductListingView
        initialKeyword="glove"
        initialBrands={[]}
        initialBrowseBrands
        initialSearchParams="q=glove&browse=brands"
      />,
      { wrapper: createWrapper() },
    );

    await user.click(
      await within(screen.getByRole('group', { name: '브랜드' })).findByRole('button', {
        name: '3M',
      }),
    );

    expect(navigationMocks.push).toHaveBeenCalledWith('/search?q=glove&browse=brands&brand=3M');
  });

  it('restores the selected brand from updated route props after browser history navigation', () => {
    const view = render(
      <ProductListingView
        initialBrands={['3M']}
        initialSearchParams="brand=3M&browse=brands"
        initialBrowseBrands
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('button', { name: '3M 삭제' })).toBeInTheDocument();

    view.rerender(
      <ProductListingView
        initialBrands={[]}
        initialSearchParams="browse=brands"
        initialBrowseBrands
      />,
    );

    expect(screen.queryByRole('button', { name: '3M 삭제' })).not.toBeInTheDocument();
  });
});

describe('ProductListingView listing toolbar', () => {
  beforeEach(() => {
    navigationMocks.pathname = '/search';
    navigationMocks.push.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      products: { list: apiMocks.listProducts, facets: apiMocks.listFacets },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.listProducts.mockResolvedValue({ items: [], page: 1, pageSize: 24, totalCount: 0 });
    apiMocks.listCategories.mockResolvedValue([]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 0,
      keywordTotalCount: 10,
      categories: [],
      brands: [],
      certifications: [],
    });
  });

  it('keeps responsive sort controls accessible and applies view changes without a new query', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const mobileSort = screen.getByLabelText('정렬', { selector: '#sort-products-mobile' });
    const desktopSort = screen.getByLabelText('정렬', { selector: '#sort-products' });
    const pageSize = screen.getByLabelText('페이지 상품 수');
    const viewToggleGroup = screen.getByRole('group', { name: '보기 방식' });
    const gridToggle = within(viewToggleGroup).getByRole('button', { name: '그리드 보기' });
    const listToggle = within(viewToggleGroup).getByRole('button', { name: '목록 보기' });
    const selectionIndicator = viewToggleGroup.querySelector('span');

    expect(mobileSort.parentElement).toHaveClass('relative', 'w-140', 'sm:hidden');
    expect(mobileSort).toHaveClass('h-40', 'w-full', 'appearance-none', 'pr-32', 'focus-ring');
    expect(desktopSort.parentElement).toHaveClass('relative', 'w-120', 'lg:w-140');
    expect(desktopSort).toHaveClass('h-40', 'w-full', 'appearance-none', 'pr-32', 'focus-ring');
    expect(pageSize.parentElement).toHaveClass('relative', 'hidden', 'w-120', 'sm:block');
    expect(pageSize).toHaveClass('h-40', 'w-full', 'appearance-none', 'pr-32', 'focus-ring');
    expect(desktopSort.parentElement?.parentElement).toHaveClass(
      'items-center',
      'gap-8',
      'sm:flex',
    );
    expect(within(mobileSort).getByRole('option', { name: '낮은 가격순' })).toBeInTheDocument();
    expect(within(pageSize).getByRole('option', { name: '24개씩' })).toBeInTheDocument();
    expect(viewToggleGroup).toHaveClass('h-40', 'w-80', 'lg:w-78', 'items-center', 'gap-2');
    expect(selectionIndicator).toHaveClass(
      'absolute',
      'size-36',
      'transition-transform',
      'motion-reduce:transition-none',
    );
    expect(selectionIndicator).not.toHaveClass('translate-x-[calc(100%+2px)]');
    expect(
      desktopSort.compareDocumentPosition(pageSize) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      pageSize.compareDocumentPosition(viewToggleGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(gridToggle).toHaveAttribute('aria-pressed', 'true');
    expect(listToggle).toHaveAttribute('aria-pressed', 'false');

    const queryCount = apiMocks.listProducts.mock.calls.length;
    await user.click(listToggle);
    expect(gridToggle).toHaveAttribute('aria-pressed', 'false');
    expect(listToggle).toHaveAttribute('aria-pressed', 'true');
    expect(selectionIndicator).toHaveClass('translate-x-[calc(100%+2px)]');
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(queryCount);
  });

  it('collapses only the empty mobile filter row while preserving responsive spacing and chips', async () => {
    const user = userEvent.setup();
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 3,
      keywordTotalCount: 3,
      categories: [],
      brands: [{ value: '3M', count: 1 }],
      certifications: [{ value: 'KS', count: 1 }],
    });
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const desktopSort = screen.getByLabelText('정렬', { selector: '#sort-products' });
    const toolbar = desktopSort.parentElement?.parentElement?.parentElement;
    const productResults = toolbar?.nextElementSibling;
    const listingGrid = toolbar?.parentElement?.parentElement;
    expect(toolbar).toHaveClass('min-h-0', 'sm:min-h-48');
    expect(listingGrid).toHaveClass('mt-24');
    expect(productResults).toHaveClass('mt-8', 'sm:mt-16');

    await user.click(screen.getByRole('button', { name: '필터' }));
    expect(screen.getByRole('button', { name: '필터' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(screen.getByRole('group', { name: '재고 상태' })).getByRole('button'));
    expect(screen.getByRole('button', { name: '전체 해제' })).toBeInTheDocument();
    expect(toolbar?.querySelectorAll('[aria-label$="삭제"]')).toHaveLength(1);
    await user.click(
      within(screen.getByRole('group', { name: '브랜드' })).getByRole('button', { name: '3M' }),
    );
    await user.click(
      within(screen.getByRole('group', { name: '안전인증' })).getByRole('button', { name: 'KS' }),
    );
    expect(toolbar?.firstElementChild).toHaveClass('flex-wrap');
    expect(toolbar?.querySelectorAll('[aria-label$="삭제"]')).toHaveLength(3);
    expect(toolbar).toHaveClass('min-h-0', 'sm:min-h-48');
    expect(productResults).toHaveClass('mt-8', 'sm:mt-16');

    await user.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(screen.queryByRole('button', { name: '전체 해제' })).not.toBeInTheDocument();
  });

  it('uses the same mobile result spacing in category listings', async () => {
    apiMocks.listCategories.mockResolvedValue([
      { id: 'category-safety', slug: 'safety', name: '안전용품', parentId: null },
    ]);
    render(<ProductListingView categorySlug="safety" />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const desktopSort = screen.getByLabelText('정렬', { selector: '#sort-products' });
    const toolbar = desktopSort.parentElement?.parentElement?.parentElement;
    expect(toolbar).toHaveClass('min-h-0', 'sm:min-h-48');
    expect(toolbar?.nextElementSibling).toHaveClass('mt-8', 'sm:mt-16');
  });

  it('uses the selected search category as the heading and the API total, then restores the search title', async () => {
    const user = userEvent.setup();
    apiMocks.listCategories.mockResolvedValue([
      {
        id: 'category-ppe',
        slug: 'personal-protection',
        name: '개인보호장비',
        parentId: null,
      },
    ]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 70,
      keywordTotalCount: 70,
      categories: [{ value: 'category-ppe', count: 60 }],
      brands: [],
      certifications: [],
    });
    apiMocks.listProducts.mockImplementation(async (params: ProductListParams) => ({
      items: [],
      page: 1,
      pageSize: 24,
      totalCount: params.categoryId === 'category-ppe' ? 8 : 70,
    }));

    render(<ProductListingView initialKeyword="장갑" />, { wrapper: createWrapper() });
    const initialTitle = await screen.findByRole('heading', { name: '‘장갑’ 검색 결과' });
    const initialHeader = initialTitle.closest('header');
    if (!initialHeader) throw new Error('상품 목록 제목 영역을 찾을 수 없습니다.');
    const initialCount = initialHeader.querySelector('p');
    if (!initialCount) throw new Error('상품 결과 개수를 찾을 수 없습니다.');
    await waitFor(() => expect(initialCount).toHaveTextContent('70개'));

    await user.click(screen.getByRole('button', { name: /^개인보호장비 60$/ }));

    const categoryTitle = await screen.findByRole('heading', { name: '개인보호장비' });
    const categoryHeader = categoryTitle.closest('header');
    if (!categoryHeader) throw new Error('상품 목록 제목 영역을 찾을 수 없습니다.');
    const categoryCount = categoryHeader.querySelector('p');
    if (!categoryCount) throw new Error('상품 결과 개수를 찾을 수 없습니다.');
    await waitFor(() => expect(categoryCount).toHaveTextContent('8개'));
    expect(categoryCount).not.toHaveTextContent('60개');
    expect(apiMocks.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'category-ppe', keyword: '장갑' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await user.click(screen.getByRole('button', { name: /^전체 70$/ }));

    const restoredTitle = await screen.findByRole('heading', { name: '‘장갑’ 검색 결과' });
    const restoredHeader = restoredTitle.closest('header');
    if (!restoredHeader) throw new Error('상품 목록 제목 영역을 찾을 수 없습니다.');
    const restoredCount = restoredHeader.querySelector('p');
    if (!restoredCount) throw new Error('상품 결과 개수를 찾을 수 없습니다.');
    expect(restoredCount).toHaveTextContent('70개');
  });

  it('hides the previous total while a newly selected category is still loading', async () => {
    const user = userEvent.setup();
    let resolveCategoryResults: ((result: PagedResult<Product>) => void) | undefined;
    apiMocks.listCategories.mockResolvedValue([
      {
        id: 'category-ppe',
        slug: 'personal-protection',
        name: '개인보호장비',
        parentId: null,
      },
    ]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 70,
      keywordTotalCount: 70,
      categories: [{ value: 'category-ppe', count: 60 }],
      brands: [],
      certifications: [],
    });
    apiMocks.listProducts.mockImplementation((params: ProductListParams) =>
      params.categoryId === 'category-ppe'
        ? new Promise((resolve) => {
            resolveCategoryResults = resolve;
          })
        : Promise.resolve({ items: [], page: 1, pageSize: 24, totalCount: 21 }),
    );

    render(<ProductListingView />, { wrapper: createWrapper() });
    const initialTitle = await screen.findByRole('heading', { name: '전체 상품' });
    const initialHeader = initialTitle.closest('header');
    if (!initialHeader) throw new Error('상품 목록 제목 영역을 찾을 수 없습니다.');
    const initialCount = initialHeader.querySelector('p');
    if (!initialCount) throw new Error('상품 결과 개수를 찾을 수 없습니다.');
    await waitFor(() => expect(initialCount).toHaveTextContent('21개'));

    await user.click(screen.getByRole('button', { name: /^개인보호장비 60$/ }));

    const categoryTitle = await screen.findByRole('heading', { name: '개인보호장비' });
    const categoryHeader = categoryTitle.closest('header');
    if (!categoryHeader) throw new Error('상품 목록 제목 영역을 찾을 수 없습니다.');
    const categoryCount = categoryHeader.querySelector('p');
    if (!categoryCount) throw new Error('상품 결과 개수를 찾을 수 없습니다.');
    await waitFor(() => expect(categoryCount).toHaveTextContent('–개'));
    expect(categoryCount).not.toHaveTextContent('21개');

    await act(async () => {
      resolveCategoryResults?.({ items: [], page: 1, pageSize: 24, totalCount: 5 });
    });

    await waitFor(() => expect(categoryCount).toHaveTextContent('5개'));
  });

  it('keeps the applied KRW range when selecting a search category', async () => {
    const user = userEvent.setup();
    apiMocks.listCategories.mockResolvedValue([
      {
        id: 'category-ppe',
        slug: 'personal-protection',
        name: '개인보호장비',
        parentId: null,
      },
    ]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 70,
      keywordTotalCount: 70,
      categories: [{ value: 'category-ppe', count: 60 }],
      brands: [],
      certifications: [],
    });

    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByRole('heading', { name: '전체 상품' });
    const priceGroup = screen.getByRole('group', { name: '데스크톱 가격 구간' });
    await user.click(within(priceGroup).getByRole('button', { name: '1~3만원' }));
    await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 10000, maxPrice: 29999 }),
      ),
    );

    await user.click(screen.getByRole('button', { name: /^개인보호장비 60$/ }));

    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          categoryId: 'category-ppe',
          minPrice: 10000,
          maxPrice: 29999,
        }),
      ),
    );
  });

  it('resets pagination to page one when sort order or page size changes', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockImplementation(
      async (params: { page: number; pageSize: number }) => ({
        items: [],
        page: params.page,
        pageSize: params.pageSize,
        totalCount: 80,
      }),
    );

    render(<ProductListingView />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: '2페이지' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 2, pageSize: 24 }),
      ),
    );

    await user.selectOptions(
      screen.getByLabelText('정렬', { selector: '#sort-products' }),
      'priceAsc',
    );
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 1, sortBy: 'priceAsc' }),
      ),
    );

    await user.click(await screen.findByRole('button', { name: '2페이지' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 2, sortBy: 'priceAsc' }),
      ),
    );
    await user.selectOptions(screen.getByLabelText('페이지 상품 수'), '48');
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 1, pageSize: 48, sortBy: 'priceAsc' }),
      ),
    );
  });

  it('shares single-select KRW ranges across mobile and desktop and applies half-open boundaries as API bounds', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const desktopPriceGroup = screen.getByRole('group', { name: '데스크톱 가격 구간' });
    await user.click(within(desktopPriceGroup).getByRole('button', { name: '1~3만원' }));
    await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));

    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 10000, maxPrice: 29999 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: '필터' }));
    const mobilePriceGroup = screen.getByRole('group', { name: '모바일 가격 구간' });
    expect(within(mobilePriceGroup).getByRole('button', { name: '1~3만원' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(mobilePriceGroup).getByRole('button', { name: '500만원 이상' }));
    await user.click(screen.getByRole('button', { name: '모바일 가격 적용' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 5000000, maxPrice: undefined }),
      ),
    );
    expect(within(desktopPriceGroup).getByRole('button', { name: '500만원 이상' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: '500만원 이상 삭제' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: undefined, maxPrice: undefined }),
      ),
    );
    expect(within(desktopPriceGroup).getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(desktopPriceGroup).getByRole('button', { name: '30~100만원' }));
    await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 300000, maxPrice: 999999 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: '전체 해제' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: undefined, maxPrice: undefined }),
      ),
    );
    expect(within(mobilePriceGroup).getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('maps the expanded upper price ranges without overlapping their integer bounds', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const desktopPriceGroup = screen.getByRole('group', { name: '데스크톱 가격 구간' });
    const ranges = [
      ['1만원 미만', undefined, 9999],
      ['1~3만원', 10000, 29999],
      ['3~5만원', 30000, 49999],
      ['5~10만원', 50000, 99999],
      ['10~30만원', 100000, 299999],
      ['30~100만원', 300000, 999999],
      ['100~300만원', 1000000, 2999999],
      ['300~500만원', 3000000, 4999999],
      ['500만원 이상', 5000000, undefined],
    ] as const;

    for (const [label, minPrice, maxPrice] of ranges) {
      await user.click(within(desktopPriceGroup).getByRole('button', { name: label }));
      await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));
      await waitFor(() =>
        expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
          expect.objectContaining({ minPrice, maxPrice }),
        ),
      );
    }
  });

  it('adds the rating sort option and resets pagination when it is selected', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockImplementation(
      async (params: { page: number; pageSize: number }) => ({
        items: [],
        page: params.page,
        pageSize: params.pageSize,
        totalCount: 80,
      }),
    );
    render(<ProductListingView />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: '2페이지' }));
    await user.selectOptions(
      screen.getByLabelText('정렬', { selector: '#sort-products' }),
      'ratingDesc',
    );

    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 1, sortBy: 'ratingDesc' }),
      ),
    );
  });
});
