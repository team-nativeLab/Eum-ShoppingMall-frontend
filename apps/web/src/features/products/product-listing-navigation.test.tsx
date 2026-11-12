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

function getDesktopPriceInputs() {
  return {
    minInput: screen.getByRole('textbox', { name: '데스크톱 최소 가격(만원)' }),
    maxInput: screen.getByRole('textbox', { name: '데스크톱 최대 가격(만원)' }),
  };
}

/** 데스크톱 가격 입력을 비우고 새 값을 넣은 뒤 적용 버튼을 누릅니다. */
async function applyDesktopPrice(
  user: ReturnType<typeof userEvent.setup>,
  minText: string,
  maxText: string,
) {
  const { minInput, maxInput } = getDesktopPriceInputs();
  await user.clear(minInput);
  await user.clear(maxInput);
  if (minText) await user.type(minInput, minText);
  if (maxText) await user.type(maxInput, maxText);
  await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));
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

  it('matches the selected grid or list layout while product results are loading', async () => {
    const user = userEvent.setup();
    apiMocks.listProducts.mockImplementation(() => new Promise<PagedResult<Product>>(() => {}));
    const { container } = render(<ProductListingView />, { wrapper: createWrapper() });

    await waitFor(() => expect(apiMocks.listProducts).toHaveBeenCalled());
    const gridSkeleton = container.querySelector('[aria-busy="true"]');
    if (!gridSkeleton) throw new Error('Expected product loading skeletons.');
    expect(gridSkeleton).toHaveClass('grid', 'grid-cols-2');
    expect(gridSkeleton.children).toHaveLength(8);
    expect(gridSkeleton.firstElementChild).toHaveClass('aspect-[181/284]', 'min-h-max');
    expect(gridSkeleton.firstElementChild?.firstElementChild).toHaveClass('aspect-[23/20]');

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    const listSkeleton = container.querySelector('[aria-busy="true"]');
    if (!listSkeleton) throw new Error('Expected product loading skeletons.');
    expect(listSkeleton).toHaveClass('flex', 'flex-col', 'gap-12');
    expect(listSkeleton.children).toHaveLength(8);
    const firstListRow = listSkeleton.firstElementChild;
    expect(firstListRow).toHaveClass('flex', 'min-h-144');
    expect(firstListRow?.firstElementChild).toHaveClass('aspect-square', 'w-144');
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

  it('keeps the applied price range when selecting a search category', async () => {
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
    await applyDesktopPrice(user, '1', '3');
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 10000, maxPrice: 30000 }),
      ),
    );

    await user.click(screen.getByRole('button', { name: /^개인보호장비 60$/ }));

    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          categoryId: 'category-ppe',
          minPrice: 10000,
          maxPrice: 30000,
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

  it('keeps price input pending until applied and resets pagination when applied', async () => {
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
    await screen.findByText('등록된 상품이 없습니다');

    await user.click(await screen.findByRole('button', { name: '2페이지' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 2 }),
      ),
    );

    const callCountBeforeTyping = apiMocks.listProducts.mock.calls.length;
    const { minInput, maxInput } = getDesktopPriceInputs();
    await user.type(minInput, '5');
    await user.type(maxInput, '30');
    expect(minInput).toHaveValue('5');
    expect(maxInput).toHaveValue('30');
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(callCountBeforeTyping);
    expect(screen.queryByRole('button', { name: /삭제$/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 50000, maxPrice: 300000, page: 1 }),
      ),
    );
    expect(screen.getByRole('button', { name: '5만원 ~ 30만원 삭제' })).toBeInTheDocument();
  });

  it('submits the price with Enter and keeps only digits in the inputs', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const { minInput, maxInput } = getDesktopPriceInputs();
    expect(minInput).toHaveAttribute('inputmode', 'numeric');
    expect(minInput).toHaveAttribute('type', 'text');
    await user.type(minInput, '1a,0');
    expect(minInput).toHaveValue('10');
    await user.type(maxInput, '20{Enter}');

    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 100000, maxPrice: 200000 }),
      ),
    );
    expect(screen.getByRole('button', { name: '10만원 ~ 20만원 삭제' })).toBeInTheDocument();
  });

  it('applies a single bound and labels it as a lower or upper limit', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    await applyDesktopPrice(user, '5', '');
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 50000, maxPrice: undefined }),
      ),
    );
    expect(screen.getByRole('button', { name: '5만원 이상 삭제' })).toBeInTheDocument();

    await applyDesktopPrice(user, '', '30');
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: undefined, maxPrice: 300000 }),
      ),
    );
    expect(screen.getByRole('button', { name: '30만원 이하 삭제' })).toBeInTheDocument();
  });

  it('does not query and reports an error when the minimum exceeds the maximum', async () => {
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
        expect.objectContaining({ page: 2 }),
      ),
    );
    const callCountBeforeApply = apiMocks.listProducts.mock.calls.length;

    await applyDesktopPrice(user, '30', '5');

    const priceGroup = screen.getByRole('group', { name: '데스크톱 가격 범위' });
    const errorMessage = within(priceGroup).getByRole('alert');
    expect(errorMessage).toHaveTextContent('최소 가격은 최대 가격보다 클 수 없습니다.');
    const { minInput, maxInput } = getDesktopPriceInputs();
    expect(minInput).toHaveAttribute('aria-invalid', 'true');
    expect(maxInput).toHaveAttribute('aria-invalid', 'true');
    expect(minInput).toHaveAttribute('aria-describedby', errorMessage.id);
    expect(maxInput).toHaveAttribute('aria-describedby', errorMessage.id);
    expect(minInput).toHaveFocus();
    expect(minInput).toHaveValue('30');
    expect(maxInput).toHaveValue('5');
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(callCountBeforeApply);
    expect(screen.queryByRole('button', { name: /삭제$/ })).not.toBeInTheDocument();

    await user.type(minInput, '{Backspace}');
    expect(within(priceGroup).queryByRole('alert')).not.toBeInTheDocument();
    expect(minInput).not.toHaveAttribute('aria-invalid');
    expect(minInput).not.toHaveAttribute('aria-describedby');
  });

  it('hides the price error once the inputs no longer match the submitted values', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    // 전체 해제 버튼이 보이도록 먼저 유효한 가격을 적용해 둡니다.
    await applyDesktopPrice(user, '1', '2');
    await screen.findByRole('button', { name: '1만원 ~ 2만원 삭제' });
    await applyDesktopPrice(user, '10', '5');
    const priceGroup = screen.getByRole('group', { name: '데스크톱 가격 범위' });
    expect(within(priceGroup).getByRole('alert')).toBeInTheDocument();

    // 다른 인스턴스(모바일)에서 값을 고치면 데스크톱 오류도 사라집니다.
    await user.click(screen.getByRole('button', { name: '필터' }));
    await user.clear(screen.getByRole('textbox', { name: '모바일 최소 가격(만원)' }));
    expect(within(priceGroup).queryByRole('alert')).not.toBeInTheDocument();
    expect(getDesktopPriceInputs().minInput).not.toHaveAttribute('aria-invalid');
    expect(getDesktopPriceInputs().maxInput).not.toHaveAttribute('aria-invalid');

    // 오류를 낸 뒤 초기화로 입력을 비워도 오류가 남지 않습니다.
    await user.type(screen.getByRole('textbox', { name: '모바일 최소 가격(만원)' }), '10');
    await user.click(screen.getByRole('button', { name: '모바일 가격 적용' }));
    expect(within(priceGroup).getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(within(priceGroup).queryByRole('alert')).not.toBeInTheDocument();
    expect(getDesktopPriceInputs().minInput).not.toHaveAttribute('aria-invalid');
  });

  it('focuses the maximum input for a maximum error and keeps a pasted 7-digit value reportable', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const { minInput, maxInput } = getDesktopPriceInputs();
    await user.click(maxInput);
    await user.paste('1,000,000');
    expect(maxInput).toHaveValue('1000000');
    await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));

    const priceGroup = screen.getByRole('group', { name: '데스크톱 가격 범위' });
    expect(within(priceGroup).getByRole('alert')).toHaveTextContent(
      '최대 가격은 999,999만원 이하로 입력해 주세요.',
    );
    expect(maxInput).toHaveFocus();
    expect(maxInput).toHaveAttribute('aria-invalid', 'true');
    expect(minInput).not.toHaveAttribute('aria-invalid');
  });

  it('treats a zero minimum as no minimum and rejects a zero maximum', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    await applyDesktopPrice(user, '0', '30');
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: undefined, maxPrice: 300000 }),
      ),
    );
    expect(getDesktopPriceInputs().minInput).toHaveValue('');
    expect(screen.getByRole('button', { name: '30만원 이하 삭제' })).toBeInTheDocument();

    const callCountBeforeZeroMax = apiMocks.listProducts.mock.calls.length;
    await applyDesktopPrice(user, '', '0');
    const priceGroup = screen.getByRole('group', { name: '데스크톱 가격 범위' });
    expect(within(priceGroup).getByRole('alert')).toHaveTextContent(
      '최대 가격은 1만원 이상으로 입력해 주세요.',
    );
    expect(getDesktopPriceInputs().maxInput).toHaveAttribute('aria-invalid', 'true');
    expect(getDesktopPriceInputs().minInput).not.toHaveAttribute('aria-invalid');
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(callCountBeforeZeroMax);
    expect(screen.getByRole('button', { name: '30만원 이하 삭제' })).toBeInTheDocument();
  });

  it('releases the price filter and resets pagination when both inputs are applied empty', async () => {
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
    await applyDesktopPrice(user, '5', '30');
    await screen.findByRole('button', { name: '5만원 ~ 30만원 삭제' });
    await user.click(await screen.findByRole('button', { name: '2페이지' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 2, minPrice: 50000 }),
      ),
    );

    await applyDesktopPrice(user, '', '');

    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ page: 1, minPrice: undefined, maxPrice: undefined }),
      ),
    );
    const priceGroup = screen.getByRole('group', { name: '데스크톱 가격 범위' });
    expect(within(priceGroup).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /삭제$/ })).not.toBeInTheDocument();
  });

  it('shares the pending inputs between desktop and mobile and applies them from either control', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    await applyDesktopPrice(user, '1', '3');
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 10000, maxPrice: 30000 }),
      ),
    );

    await user.click(screen.getByRole('button', { name: '필터' }));
    const mobileMinInput = screen.getByRole('textbox', { name: '모바일 최소 가격(만원)' });
    const mobileMaxInput = screen.getByRole('textbox', { name: '모바일 최대 가격(만원)' });
    expect(mobileMinInput).toHaveValue('1');
    expect(mobileMaxInput).toHaveValue('3');

    const callsBeforeChangingPendingInput = apiMocks.listProducts.mock.calls.length;
    await user.clear(mobileMaxInput);
    await user.type(mobileMaxInput, '500');
    expect(getDesktopPriceInputs().maxInput).toHaveValue('500');
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(callsBeforeChangingPendingInput);

    await user.click(screen.getByRole('button', { name: '모바일 가격 적용' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: 10000, maxPrice: 5000000 }),
      ),
    );
    expect(screen.getByRole('button', { name: '1만원 ~ 500만원 삭제' })).toBeInTheDocument();
  });

  it('clears the price from its chip and from the filter reset action', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    await applyDesktopPrice(user, '1', '3');
    await user.click(await screen.findByRole('button', { name: '1만원 ~ 3만원 삭제' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: undefined, maxPrice: undefined }),
      ),
    );
    expect(getDesktopPriceInputs().minInput).toHaveValue('');
    expect(getDesktopPriceInputs().maxInput).toHaveValue('');

    await applyDesktopPrice(user, '3', '5');
    await screen.findByRole('button', { name: '3만원 ~ 5만원 삭제' });
    await user.type(getDesktopPriceInputs().minInput, '0');
    await user.click(screen.getByRole('button', { name: '전체 해제' }));
    await waitFor(() =>
      expect(apiMocks.listProducts.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ minPrice: undefined, maxPrice: undefined }),
      ),
    );
    expect(getDesktopPriceInputs().minInput).toHaveValue('');
    expect(getDesktopPriceInputs().maxInput).toHaveValue('');
  });

  it('converts 만원 input to won for the API bounds', async () => {
    const user = userEvent.setup();
    render(<ProductListingView />, { wrapper: createWrapper() });
    await screen.findByText('등록된 상품이 없습니다');

    const priceInputs = [
      ['1', '3', 10000, 30000],
      ['5', '10', 50000, 100000],
      ['100', '300', 1000000, 3000000],
      ['010', '020', 100000, 200000],
      ['999999', '', 9999990000, undefined],
    ] as const;

    for (const [minText, maxText, minPrice, maxPrice] of priceInputs) {
      await applyDesktopPrice(user, minText, maxText);
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
