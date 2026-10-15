import { ApiError } from '@eum/api/errors';
import type { Brand, PagedResult, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandDetailView } from './brand-detail-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  getBrand: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
// 상품 카드는 장바구니·찜 컨텍스트가 필요해 이름만 그리는 대역으로 바꿉니다.
vi.mock('@/features/products/product-card', () => ({
  ProductCard: ({ product }: { product: Product }) => <article>{product.name}</article>,
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

const testBrand: Brand = {
  id: 'brd-test',
  name: '테스트 & 브랜드',
  englishName: 'TEST',
  logoUrl: null,
  tagline: '<b>첫 줄</b>\n둘째 줄',
  productCount: 23,
  coverImageUrl: null,
  mainField: '개인보호장비',
  originCountry: '대한민국',
  certification: null,
  story: { title: '스토리 제목', body: '스토리 본문입니다.' },
};

// 테스트용 상품(카드 대역은 이름만 씁니다)
function buildProduct(productId: string, name: string): Product {
  return {
    id: productId,
    name,
    brand: testBrand.name,
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
    shipping: { method: '', estimate: '', fee: 0, countryOfOrigin: '', policy: '' },
    purchaseNotices: [],
    rating: null,
    reviewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    isFeatured: false,
  };
}

// 테스트용 상품 목록 응답
function buildProductPage(itemCount: number, totalCount: number): PagedResult<Product> {
  return {
    items: Array.from({ length: itemCount }, (_, productIndex) =>
      buildProduct(`prd-${productIndex}`, `상품 ${productIndex + 1}`),
    ),
    page: 1,
    pageSize: 8,
    totalCount,
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

describe('BrandDetailView', () => {
  beforeEach(() => {
    apiMocks.getBrand.mockReset();
    apiMocks.listProducts.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      brands: { getById: apiMocks.getBrand },
      products: { list: apiMocks.listProducts },
    });
    apiMocks.getBrand.mockResolvedValue(testBrand);
    apiMocks.listProducts.mockResolvedValue(buildProductPage(8, 23));
  });

  it('shows the not-found state with a link back to the brand list', async () => {
    apiMocks.getBrand.mockRejectedValue(new ApiError('NOT_FOUND', 'missing'));
    render(<BrandDetailView brandId="brd-missing" />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: '브랜드를 찾을 수 없습니다' })).toBeVisible();
    expect(screen.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
      'href',
      '/brands',
    );
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('retries a temporary brand failure', async () => {
    const user = userEvent.setup();
    apiMocks.getBrand
      .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
      .mockResolvedValueOnce(testBrand);
    render(<BrandDetailView brandId="brd-test" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '테스트 & 브랜드' }),
    ).toBeInTheDocument();
  });

  it('does not request products while the brand is still loading', async () => {
    apiMocks.getBrand.mockReturnValue(new Promise<never>(() => {}));
    render(<BrandDetailView brandId="brd-test" />, { wrapper: createWrapper() });

    await waitFor(() => expect(apiMocks.getBrand).toHaveBeenCalled());
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('filters products by the brand name and uses totalCount for the CTA', async () => {
    render(<BrandDetailView brandId="brd-test" />, { wrapper: createWrapper() });

    const productsCta = await screen.findByRole('link', { name: '제품 23개 보기' });
    expect(productsCta).toHaveAttribute(
      'href',
      '/search?brand=%ED%85%8C%EC%8A%A4%ED%8A%B8+%26+%EB%B8%8C%EB%9E%9C%EB%93%9C',
    );
    expect(apiMocks.listProducts).toHaveBeenCalledWith(
      { brand: ['테스트 & 브랜드'], pageSize: 8 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const productsSection = screen.getByRole('region', { name: /제품/ });
    expect(within(productsSection).getAllByRole('article')).toHaveLength(8);
    expect(within(productsSection).getByRole('heading', { level: 2 })).toHaveTextContent(
      '제품23개',
    );
    expect(within(productsSection).getByRole('link', { name: '전체 제품 보기' })).toBeVisible();
  });

  it('hides the CTA count while products are loading', async () => {
    apiMocks.listProducts.mockReturnValue(new Promise<never>(() => {}));
    render(<BrandDetailView brandId="brd-test" />, { wrapper: createWrapper() });

    expect(await screen.findByRole('link', { name: '제품 보기' })).toBeInTheDocument();
    expect(screen.queryByText(/제품 \d+개 보기/)).not.toBeInTheDocument();
  });

  it('shows an empty product state and disables the CTA when the brand has no products', async () => {
    apiMocks.listProducts.mockResolvedValue(buildProductPage(0, 0));
    render(<BrandDetailView brandId="brd-test" />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: '등록된 제품이 없습니다' })).toBeVisible();
    const disabledCta = screen.getByText('제품 0개 보기');
    expect(disabledCta).toHaveAttribute('aria-disabled', 'true');
    expect(disabledCta.closest('a')).toBeNull();
  });

  it('renders admin-entered text as plain text and shows only facts with values', async () => {
    const { container } = render(<BrandDetailView brandId="brd-test" />, {
      wrapper: createWrapper(),
    });

    const tagline = await screen.findByText(/<b>첫 줄<\/b>/);
    expect(tagline).toHaveClass('whitespace-pre-line');
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: '스토리 제목' })).toBeInTheDocument();
    expect(screen.getByText('주력 분야')).toBeInTheDocument();
    expect(screen.getByText('원산지')).toBeInTheDocument();
    expect(screen.queryByText('주요 인증')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '테스트 & 브랜드 로고' })).toBeInTheDocument();
  });

  it('wraps long unbroken names and admin-entered brand text', async () => {
    const longBrandName = `브랜드${'가나다'.repeat(60)}`;
    const longEnglishName = `EN${'GLISH'.repeat(60)}`;
    const longMainField = `분야${'산업용'.repeat(60)}`;
    const longTagline = `소개${'안전용품'.repeat(60)}`;
    const longStoryTitle = `스토리${'현장보호'.repeat(60)}`;
    const longStoryBody = `본문${'작업환경안전'.repeat(60)}`;
    apiMocks.getBrand.mockResolvedValue({
      ...testBrand,
      name: longBrandName,
      englishName: longEnglishName,
      mainField: longMainField,
      tagline: longTagline,
      story: { title: longStoryTitle, body: longStoryBody },
    });
    render(<BrandDetailView brandId="brd-long-text" />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { level: 1, name: longBrandName })).toHaveClass(
      'break-words',
    );
    expect(screen.getByText(`${longEnglishName} · ${longMainField}`)).toHaveClass('break-words');
    expect(screen.getByText(longTagline)).toHaveClass('break-words');
    expect(screen.getByRole('heading', { level: 2, name: longStoryTitle })).toHaveClass(
      'break-words',
    );
    expect(screen.getByText(longStoryBody)).toHaveClass('break-words');
    expect(screen.getByText('주력 분야').parentElement?.querySelector('dd')).toHaveClass(
      'break-words',
    );
  });

  it('loads the top-of-page cover eagerly and reserves its responsive hero height', async () => {
    apiMocks.getBrand.mockResolvedValue({
      ...testBrand,
      coverImageUrl: 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E',
    });
    const { container } = render(<BrandDetailView brandId="brd-cover" />, {
      wrapper: createWrapper(),
    });

    await screen.findByRole('heading', { level: 1, name: '테스트 & 브랜드' });
    const coverImages = container.querySelectorAll(
      'section[aria-labelledby="brand-name-heading"] img[alt=""]',
    );
    expect(coverImages).toHaveLength(2);
    for (const coverImage of coverImages) {
      expect(coverImage).toHaveAttribute('loading', 'eager');
      expect(coverImage).toHaveAttribute('fetchpriority', 'high');
      expect(coverImage).toHaveAttribute('decoding', 'async');
      expect(coverImage).toHaveClass('size-full', 'object-cover');
    }
    expect(coverImages.item(0).parentElement).toHaveClass('h-220');
    expect(coverImages.item(1).parentElement).toHaveClass('h-352');
  });
});
