import { ApiError } from '@eum/api/errors';
import type { Brand, BrandSummary, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProductListParams } from '@eum/api/shop-api';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandDetailView } from './brand-detail-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  getBrandById: vi.fn(),
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  listFacets: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/brands/brd-workfit',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...linkProps
  }: {
    href: string;
    children: ReactNode;
    [propName: string]: unknown;
  }) => (
    <a href={href} {...linkProps}>
      {children}
    </a>
  ),
}));

// 상품 카드는 장바구니·찜 컨텍스트가 필요하므로 이름만 그리는 가짜 카드로 바꿉니다(캐러셀 트랙의 li 개수는 그대로 셉니다).
vi.mock('@/features/products/product-card', () => ({
  ProductCard: ({ product }: { product: Product }) => <article>{product.name}</article>,
}));

const BRAND_ID = 'brd-workfit';
const BRAND_NAME = '워크핏';

function buildBrandSummary(overrides: Partial<BrandSummary> = {}): BrandSummary {
  return {
    id: BRAND_ID,
    name: BRAND_NAME,
    englishName: 'WORKFIT',
    logoUrl: null,
    tagline: '현장 안전화 전문 브랜드입니다.',
    productCount: 3,
    ...overrides,
  };
}

function buildBrandDetail(overrides: Partial<Brand> = {}): Brand {
  return {
    ...buildBrandSummary(),
    coverImageUrl: null,
    mainField: '안전화',
    originCountry: null,
    certification: null,
    story: null,
    ...overrides,
  };
}

/**
 * 빈 상태와 안내 상태는 헤더가 나온 뒤 늦은 요청이 없는지 봐야 합니다.
 * 상품 목록 뷰는 성공 분기에서만 마운트되므로, 헤더가 나온 뒤 짧게 기다리면 목록 요청이 있었다면 드러납니다.
 */
async function waitForLateRequests() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('BrandDetailView', () => {
  beforeEach(() => {
    apiMocks.getShopApi.mockResolvedValue({
      brands: { getById: apiMocks.getBrandById },
      products: { list: apiMocks.listProducts, facets: apiMocks.listFacets },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.getBrandById.mockReset().mockResolvedValue(buildBrandDetail());
    apiMocks.listProducts.mockReset().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 24,
      totalCount: 0,
    });
    apiMocks.listCategories.mockResolvedValue([]);
    apiMocks.listFacets.mockResolvedValue({
      totalCount: 3,
      keywordTotalCount: 3,
      categories: [],
      brands: [{ value: BRAND_NAME, count: 3 }],
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows only a busy placeholder while the brand is resolving and does not list all products', () => {
    apiMocks.getBrandById.mockReturnValue(new Promise<never>(() => {}));
    const { container } = render(<BrandDetailView brandId={BRAND_ID} />, {
      wrapper: createWrapper(),
    });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '전체 상품' })).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('lists the brand products with the brand name as a fixed filter and as the heading', async () => {
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { level: 1, name: BRAND_NAME })).toBeVisible();
    await waitFor(() => expect(apiMocks.listProducts).toHaveBeenCalled());
    const [params] = apiMocks.listProducts.mock.calls[0] as [ProductListParams];
    expect(params.brand).toEqual([BRAND_NAME]);
    expect(apiMocks.getBrandById).toHaveBeenCalledWith(BRAND_ID, expect.anything());
  });

  it('shows a text back link to the brand list above the product list heading', async () => {
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    await screen.findByRole('heading', { level: 1, name: BRAND_NAME });
    expect(screen.getByRole('link', { name: '브랜드 목록' })).toHaveAttribute('href', '/brands');
  });

  it('does not show a breadcrumb on the brand product list', async () => {
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    await screen.findByRole('heading', { level: 1, name: BRAND_NAME });
    expect(screen.queryByRole('link', { name: '홈' })).not.toBeInTheDocument();
  });

  it('does not query products before the brand name is known', () => {
    apiMocks.getBrandById.mockReturnValue(new Promise<never>(() => {}));
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the brand-only empty state with a link to the brand list when the brand has no products', async () => {
    apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ productCount: 0 }));
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(
      await screen.findByRole('heading', { name: '이 브랜드의 상품이 없습니다' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
      'href',
      '/brands',
    );
    await waitForLateRequests();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the not-found guidance and requests no product list when the brand name is blank', async () => {
    apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ name: '   ' }));
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: '브랜드를 찾을 수 없습니다' })).toBeVisible();
    expect(screen.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
      'href',
      '/brands',
    );
    await waitForLateRequests();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the not-found guidance with a link back to the brand list for an unknown brand', async () => {
    apiMocks.getBrandById.mockRejectedValue(new ApiError('NOT_FOUND', BRAND_ID));
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: '브랜드를 찾을 수 없습니다' })).toBeVisible();
    expect(screen.getByText('주소가 바뀌었거나 더 이상 공개하지 않는 브랜드입니다.')).toBeVisible();
    expect(screen.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
      'href',
      '/brands',
    );
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the not-implemented notice without a retry button', async () => {
    apiMocks.getBrandById.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.getById'));
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
    expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows a retry button only for a temporary failure and loads the brand after a retry', async () => {
    const user = userEvent.setup();
    apiMocks.getBrandById
      .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
      .mockResolvedValueOnce(buildBrandDetail());
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드를 불러오지 못했습니다');
    await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('heading', { level: 1, name: BRAND_NAME })).toBeVisible();
    expect(apiMocks.getBrandById).toHaveBeenCalledTimes(2);
  });

  it('shows the brand name as the only heading, with the tagline and then the product count', async () => {
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { level: 1, name: BRAND_NAME })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('현장 안전화 전문 브랜드입니다.')).toBeVisible();
    expect(screen.getByText('제품 3개')).toBeVisible();
    const tagline = screen.getByText('현장 안전화 전문 브랜드입니다.');
    const count = screen.getByText('제품 3개');
    expect(tagline.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render a description line when the brand has no tagline', async () => {
    apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ tagline: null }));
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { level: 1, name: BRAND_NAME })).toBeVisible();
    expect(screen.queryByText('현장 안전화 전문 브랜드입니다.')).not.toBeInTheDocument();
  });

  it('does not show the brand card grid or a 제품 보기 link on the brand page', async () => {
    render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    await screen.findByRole('heading', { level: 1, name: BRAND_NAME });
    expect(screen.queryByRole('link', { name: '제품 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /제품 \d+개$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^워크핏, 제품/ })).not.toBeInTheDocument();
  });

  describe('hero and product carousel', () => {
    function buildProducts(count: number): Product[] {
      return Array.from(
        { length: count },
        (_, index) => ({ id: `p-${index}`, name: `워크핏 상품 ${index}` }) as Product,
      );
    }

    it('requests the brand top 10 products for the carousel, not the filterable listing', async () => {
      apiMocks.listProducts.mockResolvedValue({
        items: buildProducts(3),
        page: 1,
        pageSize: 10,
        totalCount: 3,
      });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      await waitFor(() => expect(apiMocks.listProducts).toHaveBeenCalled());
      const [params] = apiMocks.listProducts.mock.calls[0] as [ProductListParams];
      expect(params).toEqual({ brand: [BRAND_NAME], pageSize: 10 });
    });

    it('shows the brand products in the two-row carousel track under the hero', async () => {
      apiMocks.listProducts.mockResolvedValue({
        items: buildProducts(3),
        page: 1,
        pageSize: 10,
        totalCount: 3,
      });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      const track = await screen.findByRole('list', { name: `${BRAND_NAME} 제품` });
      expect(within(track).getAllByRole('listitem')).toHaveLength(3);
      // 문서 순서: 히어로(제목 region)가 캐러셀 목록보다 먼저 나와야 합니다.
      const hero = screen.getByRole('region', { name: BRAND_NAME });
      expect(hero.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: `${BRAND_NAME} 제품` })).toHaveClass(
        'sr-only',
      );
    });

    it('shows previous and next arrows only when the products span more than one page, and moves to the next page', async () => {
      const user = userEvent.setup();
      apiMocks.listProducts.mockResolvedValue({
        items: buildProducts(12),
        page: 1,
        pageSize: 10,
        totalCount: 12,
      });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      const previousButton = await screen.findByRole('button', { name: `이전 ${BRAND_NAME} 제품` });
      const nextButton = screen.getByRole('button', { name: `다음 ${BRAND_NAME} 제품` });
      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeEnabled();

      await user.click(nextButton);

      expect(await screen.findByText('2페이지 중 2페이지')).toBeInTheDocument();
      expect(nextButton).toBeDisabled();
      expect(previousButton).toBeEnabled();
    });

    it('shows no arrows when all brand products fit on one page', async () => {
      apiMocks.listProducts.mockResolvedValue({
        items: buildProducts(3),
        page: 1,
        pageSize: 10,
        totalCount: 3,
      });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      await screen.findByRole('list', { name: `${BRAND_NAME} 제품` });
      expect(
        screen.queryByRole('button', { name: `다음 ${BRAND_NAME} 제품` }),
      ).not.toBeInTheDocument();
    });

    it('shows a skeleton while the carousel products load', async () => {
      apiMocks.listProducts.mockReturnValue(new Promise<never>(() => {}));
      const { container } = render(<BrandDetailView brandId={BRAND_ID} />, {
        wrapper: createWrapper(),
      });

      expect(await screen.findByTestId('brand-products-skeleton')).toHaveAttribute(
        'aria-busy',
        'true',
      );
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('shows a retry button only for a temporary product failure and reloads the carousel', async () => {
      const user = userEvent.setup();
      apiMocks.listProducts
        .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
        .mockResolvedValueOnce({ items: buildProducts(2), page: 1, pageSize: 10, totalCount: 2 });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent('상품을 불러오지 못했습니다');
      await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));

      expect(await screen.findByRole('list', { name: `${BRAND_NAME} 제품` })).toBeVisible();
    });

    it('shows a line that nothing can be bought and a link to other brands when the loaded list is empty', async () => {
      apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ productCount: 2 }));
      apiMocks.listProducts.mockResolvedValue({ items: [], page: 1, pageSize: 10, totalCount: 0 });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      expect(await screen.findByText('지금 구매할 수 있는 제품이 없습니다')).toBeVisible();
      expect(screen.getByRole('link', { name: '다른 브랜드 보기' })).toHaveAttribute(
        'href',
        '/brands',
      );
      expect(screen.queryByRole('list', { name: `${BRAND_NAME} 제품` })).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: `${BRAND_NAME} 제품` })).toBeVisible();
    });

    it('keeps the skeleton, not the empty line, while the carousel list is still loading', async () => {
      apiMocks.listProducts.mockReturnValue(new Promise<never>(() => {}));
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      expect(await screen.findByTestId('brand-products-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('지금 구매할 수 있는 제품이 없습니다')).not.toBeInTheDocument();
    });

    it('shows no 전체 보기 link and no filter panel on the brand page', async () => {
      apiMocks.listProducts.mockResolvedValue({
        items: buildProducts(3),
        page: 1,
        pageSize: 10,
        totalCount: 3,
      });
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      await screen.findByRole('list', { name: `${BRAND_NAME} 제품` });
      expect(screen.queryByRole('link', { name: '전체 보기' })).not.toBeInTheDocument();
      expect(screen.queryByText('필터')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();
    });
  });

  describe('hero colors and logo', () => {
    it('uses the verified accent color as the hero background and labels the logo with the brand name', async () => {
      apiMocks.getBrandById.mockResolvedValue(
        buildBrandDetail({ logoUrl: 'https://example.com/workfit.png', accentColor: '#F2F2F2' }),
      );
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      const hero = await screen.findByRole('region', { name: BRAND_NAME });
      expect(hero).toHaveStyle({ backgroundColor: '#F2F2F2' });
      const logo = within(hero).getByRole('img', { name: `${BRAND_NAME} 로고` });
      expect(logo).toHaveAttribute('src', 'https://example.com/workfit.png');
      // 히어로 로고는 첫 화면 후보라 lazy로 두지 않습니다.
      expect(logo).toHaveAttribute('loading', 'eager');
    });

    it('uses black text on a light accent color', async () => {
      apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ accentColor: '#F2F2F2' }));
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      expect(await screen.findByRole('region', { name: BRAND_NAME })).toHaveClass(
        'text-text-accent-black',
      );
    });

    it('uses white text on a dark accent color', async () => {
      apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ accentColor: '#2F6F62' }));
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      const hero = await screen.findByRole('region', { name: BRAND_NAME });
      expect(hero).toHaveClass('text-inverse');
      expect(hero).toHaveStyle({ backgroundColor: '#2F6F62' });
    });

    it('falls back to the default color and white text when the accent color is invalid', async () => {
      apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ accentColor: 'red' }));
      render(<BrandDetailView brandId={BRAND_ID} />, { wrapper: createWrapper() });

      const hero = await screen.findByRole('region', { name: BRAND_NAME });
      expect(hero).toHaveStyle({ backgroundColor: '#2F6F62' });
      expect(hero).toHaveClass('text-inverse');
    });
  });
});
