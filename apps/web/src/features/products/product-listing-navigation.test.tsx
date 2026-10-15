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

  it('restores the selected brand from route state and opens filters on request', async () => {
    const user = userEvent.setup();
    render(<ProductListingView initialKeyword="glove" initialBrands={['3M']} />, {
      wrapper: createWrapper(),
    });

    const filterButton = screen.getByRole('button', { name: '필터' });
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(filterButton);
    const brandHeading = screen.getByRole('heading', { name: '브랜드', level: 2 });
    expect(brandHeading).toBeVisible();
    const brandGroup = screen.getByRole('group', { name: '브랜드' });
    expect(brandGroup).toHaveAttribute('aria-labelledby', brandHeading.id);
    const selectedBrandChip = await within(brandGroup).findByRole('button', { name: '3M' });
    expect(selectedBrandChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('pushes a brand selection into the URL without dropping the query', async () => {
    const user = userEvent.setup();
    render(
      <ProductListingView
        initialKeyword="glove"
        initialBrands={[]}
        initialSearchParams="q=glove"
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole('button', { name: '필터' }));

    await user.click(
      await within(screen.getByRole('group', { name: '브랜드' })).findByRole('button', {
        name: '3M',
      }),
    );

    expect(navigationMocks.push).toHaveBeenCalledWith('/search?q=glove&brand=3M');
  });

  it('restores the selected brand from updated route props after browser history navigation', () => {
    const view = render(
      <ProductListingView initialBrands={['3M']} initialSearchParams="brand=3M&browse=brands" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('button', { name: '3M 삭제' })).toBeInTheDocument();

    view.rerender(<ProductListingView initialBrands={[]} initialSearchParams="browse=brands" />);

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
