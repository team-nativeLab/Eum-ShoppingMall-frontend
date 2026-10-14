import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    expect(mobileSort).toHaveClass('sm:hidden');
    expect(mobileSort).toHaveClass('h-40', 'w-140');
    expect(desktopSort).toHaveClass('h-40', 'w-120', 'lg:w-140');
    expect(pageSize).toHaveClass('h-40', 'hidden', 'w-120', 'sm:block');
    expect(desktopSort.parentElement).toHaveClass('items-center', 'gap-8', 'sm:flex');
    expect(viewToggleGroup).toHaveClass('h-40', 'w-80', 'items-center', 'gap-2');
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
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(queryCount);
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
});
