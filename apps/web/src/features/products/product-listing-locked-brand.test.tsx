import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProductListParams } from '@eum/api/shop-api';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductListingView } from './product-listing-view';

const navigationMocks = vi.hoisted(() => ({
  pathname: '/brands/brd-workfit/products',
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

const LOCKED_BRAND = '3M';
const OTHER_BRAND = '동아';
const CATEGORY_NAME = '개인보호장비';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** 마지막으로 보낸 상품 목록 요청의 조건을 돌려줍니다. */
function getLastProductParams(): ProductListParams {
  const lastCall = apiMocks.listProducts.mock.calls.at(-1);
  if (!lastCall) throw new Error('상품 목록 요청이 없습니다.');
  return lastCall[0] as ProductListParams;
}

/** 데스크톱 가격 입력을 채우고 적용합니다. */
async function applyDesktopMinPrice(user: ReturnType<typeof userEvent.setup>, minText: string) {
  await user.type(screen.getByRole('textbox', { name: '데스크톱 최소 가격(만원)' }), minText);
  await user.click(screen.getByRole('button', { name: '데스크톱 가격 적용' }));
}

function stubMatchMedia() {
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
}

describe('ProductListingView with a locked brand', () => {
  beforeEach(() => {
    navigationMocks.pathname = '/brands/brd-workfit/products';
    navigationMocks.push.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      products: { list: apiMocks.listProducts, facets: apiMocks.listFacets },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.listProducts.mockReset().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 24,
      totalCount: 0,
    });
    apiMocks.listCategories.mockResolvedValue([
      { id: 'category-ppe', slug: 'personal-protection', name: CATEGORY_NAME, parentId: null },
    ]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 6,
      keywordTotalCount: 6,
      categories: [{ value: 'category-ppe', count: 4 }],
      brands: [
        { value: LOCKED_BRAND, count: 4 },
        { value: OTHER_BRAND, count: 2 },
      ],
      certifications: [],
    });
    stubMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderLockedListing() {
    return render(
      <ProductListingView
        initialBrands={[LOCKED_BRAND]}
        lockedBrand={LOCKED_BRAND}
        pageTitle={LOCKED_BRAND}
        hideBreadcrumb
      />,
      { wrapper: createWrapper() },
    );
  }

  it('uses the brand name as the heading and keeps the locked brand in every request', async () => {
    renderLockedListing();

    expect(screen.getByRole('heading', { level: 1, name: LOCKED_BRAND })).toBeVisible();
    expect(await screen.findByText('총 0개')).toBeVisible();
    expect(getLastProductParams().brand).toEqual([LOCKED_BRAND]);
    // 고정 브랜드는 적용된 필터 칩이 아니므로 「전체 해제」도 보이지 않습니다.
    expect(screen.queryByRole('button', { name: '전체 해제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${LOCKED_BRAND} 삭제` })).not.toBeInTheDocument();
  });

  it('does not render any brand filter, so the locked brand cannot be unchecked or other brands added', async () => {
    const user = userEvent.setup();
    renderLockedListing();

    await user.click(screen.getByRole('button', { name: '필터' }));

    expect(screen.queryByRole('group', { name: '브랜드' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '브랜드', level: 2 })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: new RegExp(LOCKED_BRAND) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(OTHER_BRAND) })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: new RegExp(LOCKED_BRAND) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: new RegExp(OTHER_BRAND) }),
    ).not.toBeInTheDocument();
    expect(navigationMocks.push).not.toHaveBeenCalled();
    expect(getLastProductParams().brand).toEqual([LOCKED_BRAND]);
  });

  it('does not render the search category chips, so no all-product count is shown for the brand', async () => {
    renderLockedListing();

    expect(await screen.findByText('총 0개')).toBeVisible();
    expect(screen.queryByRole('group', { name: '검색 결과 카테고리' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: new RegExp(CATEGORY_NAME) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^전체 \d/)).not.toBeInTheDocument();
  });

  it('hides the certification counts in the locked brand list because they are not brand-scoped', async () => {
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 6,
      keywordTotalCount: 6,
      categories: [],
      brands: [{ value: LOCKED_BRAND, count: 4 }],
      certifications: [{ value: 'KS', count: 9 }],
    });
    renderLockedListing();

    const certificationCheckbox = await screen.findByRole('checkbox', { name: 'KS' });
    expect(certificationCheckbox).toBeEnabled();
    // 체크박스 자체에는 글자가 없으므로, 감싼 label에서 개수가 빠졌는지 확인합니다.
    expect(certificationCheckbox.closest('label')).toHaveTextContent('KS');
    expect(certificationCheckbox.closest('label')).not.toHaveTextContent('9');
  });

  it('keeps the locked brand when the filter reset in the sidebar clears the other filters', async () => {
    const user = userEvent.setup();
    renderLockedListing();

    await applyDesktopMinPrice(user, '3');
    expect(getLastProductParams().minPrice).toBe(30_000);

    const sidebar = screen.getByRole('complementary', { name: '상품 필터' });
    await user.click(within(sidebar).getByRole('button', { name: '초기화' }));

    expect(getLastProductParams().minPrice).toBeUndefined();
    expect(getLastProductParams().brand).toEqual([LOCKED_BRAND]);
  });

  it('keeps the locked brand when the all-clear action removes another filter', async () => {
    const user = userEvent.setup();
    renderLockedListing();

    await applyDesktopMinPrice(user, '3');
    await user.click(await screen.findByRole('button', { name: '전체 해제' }));

    expect(getLastProductParams().minPrice).toBeUndefined();
    expect(getLastProductParams().brand).toEqual([LOCKED_BRAND]);
  });

  it('shows the brand-only empty state and a link back to the brand list when no product matches', async () => {
    renderLockedListing();

    expect(
      await screen.findByRole('heading', { name: '이 브랜드의 상품이 없습니다' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
      'href',
      '/brands',
    );
    expect(screen.queryByRole('link', { name: '전체 상품 보기' })).not.toBeInTheDocument();
  });

  it('offers the filter reset in the empty state only when another filter narrows the results, and keeps the brand', async () => {
    const user = userEvent.setup();
    renderLockedListing();

    await applyDesktopMinPrice(user, '3');

    expect(
      await screen.findByRole('heading', { name: '조건에 맞는 상품이 없습니다' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: '필터 전체 해제' }));
    expect(getLastProductParams().minPrice).toBeUndefined();
    expect(getLastProductParams().brand).toEqual([LOCKED_BRAND]);
  });

  it('shows the total with the 총 prefix next to the brand heading', async () => {
    renderLockedListing();

    expect(await screen.findByText('총 0개')).toBeVisible();
  });
});

describe('ProductListingView without a locked brand', () => {
  beforeEach(() => {
    navigationMocks.pathname = '/search';
    navigationMocks.push.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      products: { list: apiMocks.listProducts, facets: apiMocks.listFacets },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.listProducts.mockReset().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 24,
      totalCount: 0,
    });
    apiMocks.listCategories.mockResolvedValue([]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 6,
      keywordTotalCount: 6,
      categories: [],
      brands: [
        { value: LOCKED_BRAND, count: 4 },
        { value: OTHER_BRAND, count: 2 },
      ],
      certifications: [{ value: 'KS', count: 9 }],
    });
    stubMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets a brand chip be unchecked and keeps the search title and empty state', async () => {
    const user = userEvent.setup();
    render(<ProductListingView initialBrands={[LOCKED_BRAND]} initialSearchParams="brand=3M" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('heading', { level: 1, name: '전체 상품' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '필터' }));
    const brandGroup = screen.getByRole('group', { name: '브랜드' });
    const brandChip = within(brandGroup).getByRole('button', { name: LOCKED_BRAND });
    expect(brandChip).toBeEnabled();

    await user.click(brandChip);

    expect(navigationMocks.push).toHaveBeenCalledWith('/search');
    expect(getLastProductParams().brand).toBeUndefined();
  });

  it('keeps the certification counts in the search list', async () => {
    render(<ProductListingView />, { wrapper: createWrapper() });

    const certificationCheckbox = await screen.findByRole('checkbox', { name: /KS/ });
    expect(certificationCheckbox.closest('label')).toHaveTextContent('9');
  });

  it('shows the generic empty state with a link to all products', async () => {
    render(<ProductListingView />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: '등록된 상품이 없습니다' })).toBeVisible();
    expect(screen.getByRole('link', { name: '전체 상품 보기' })).toHaveAttribute('href', '/search');
    expect(screen.queryByRole('link', { name: '브랜드 목록 보기' })).not.toBeInTheDocument();
  });
});
