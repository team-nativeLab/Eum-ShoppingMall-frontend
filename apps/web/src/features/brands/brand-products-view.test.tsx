import { ApiError } from '@eum/api/errors';
import type { Brand, BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProductListParams } from '@eum/api/shop-api';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandProductsView } from './brand-products-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  getBrandById: vi.fn(),
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  listFacets: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/brands/brd-workfit/products',
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

vi.mock('@/lib/use-media-query', () => ({
  getScrollBehavior: () => 'auto',
  usePrefersReducedMotion: () => true,
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('BrandProductsView', () => {
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
    const { container } = render(<BrandProductsView brandId={BRAND_ID} />, {
      wrapper: createWrapper(),
    });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '전체 상품' })).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('lists the brand products with the brand name as a fixed filter and as the heading', async () => {
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { level: 1, name: BRAND_NAME })).toBeVisible();
    await waitFor(() => expect(apiMocks.listProducts).toHaveBeenCalled());
    const [params] = apiMocks.listProducts.mock.calls[0] as [ProductListParams];
    expect(params.brand).toEqual([BRAND_NAME]);
    expect(apiMocks.getBrandById).toHaveBeenCalledWith(BRAND_ID, expect.anything());
  });

  it('shows a text back link to the brand list above the product list heading', async () => {
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    await screen.findByRole('heading', { level: 1, name: BRAND_NAME });
    expect(screen.getByRole('link', { name: '브랜드 목록' })).toHaveAttribute('href', '/brands');
  });

  it('does not show a breadcrumb on the brand product list', async () => {
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    await screen.findByRole('heading', { level: 1, name: BRAND_NAME });
    expect(screen.queryByRole('link', { name: '홈' })).not.toBeInTheDocument();
  });

  it('does not query products before the brand name is known', () => {
    apiMocks.getBrandById.mockReturnValue(new Promise<never>(() => {}));
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the brand-only empty state with a link to the brand list when the brand has no products', async () => {
    apiMocks.getBrandById.mockResolvedValue(buildBrandDetail({ productCount: 0 }));
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    expect(
      await screen.findByRole('heading', { name: '이 브랜드의 상품이 없습니다' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
      'href',
      '/brands',
    );
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows the not-found guidance with a link back to the brand list for an unknown brand', async () => {
    apiMocks.getBrandById.mockRejectedValue(new ApiError('NOT_FOUND', BRAND_ID));
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

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
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

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
    render(<BrandProductsView brandId={BRAND_ID} />, { wrapper: createWrapper() });

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드를 불러오지 못했습니다');
    await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('heading', { level: 1, name: BRAND_NAME })).toBeVisible();
    expect(apiMocks.getBrandById).toHaveBeenCalledTimes(2);
  });
});
