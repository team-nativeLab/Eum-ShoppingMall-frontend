import { ApiError } from '@eum/api/errors';
import type { Brand, BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandDirectoryView } from './brand-directory-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listBrands: vi.fn(),
  getFeaturedBrand: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
// 모바일(한 번에 12개) 기준으로 확인합니다.
vi.mock('@/lib/use-media-query', () => ({
  DESKTOP_QUERY: '(min-width: 64rem)',
  useMediaQuery: () => false,
  usePrefersReducedMotion: () => true,
  getScrollBehavior: () => 'auto',
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

const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
);

// 테스트용 브랜드 목록 항목
function buildBrandSummary(brandId: string, name: string): BrandSummary {
  return { id: brandId, name, englishName: null, logoUrl: null, tagline: null, productCount: 3 };
}

// ㄱ 5개, ㅅ 5개, A–Z 5개 = 15개(모바일 첫 화면 12개 + 더 보기 3개)
const directoryBrands: BrandSummary[] = [
  ...['가', '거', '고', '구', '기'].map((prefix, brandIndex) =>
    buildBrandSummary(`brd-g${brandIndex}`, `${prefix}브랜드`),
  ),
  ...['사', '서', '소', '수', '시'].map((prefix, brandIndex) =>
    buildBrandSummary(`brd-s${brandIndex}`, `${prefix}브랜드`),
  ),
  ...['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((name, brandIndex) =>
    buildBrandSummary(`brd-e${brandIndex}`, name),
  ),
];

const featuredBrand: Brand = {
  ...buildBrandSummary('brd-featured', '이달브랜드'),
  tagline: '이달의 소개입니다.',
  coverImageUrl: null,
  mainField: '개인보호장비',
  originCountry: null,
  certification: null,
  story: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('BrandDirectoryView', () => {
  beforeEach(() => {
    apiMocks.listBrands.mockReset();
    apiMocks.getFeaturedBrand.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      brands: { list: apiMocks.listBrands, getFeatured: apiMocks.getFeaturedBrand },
    });
    apiMocks.listBrands.mockResolvedValue(directoryBrands);
    apiMocks.getFeaturedBrand.mockResolvedValue(featuredBrand);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('shows a busy placeholder while brands load', () => {
    apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
    apiMocks.getFeaturedBrand.mockReturnValue(new Promise<never>(() => {}));
    const { container } = render(<BrandDirectoryView />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('navigation', { name: '브랜드 색인' })).not.toBeInTheDocument();
  });

  it('shows the empty state and hides the spotlight when nothing is registered', async () => {
    apiMocks.listBrands.mockResolvedValue([]);
    apiMocks.getFeaturedBrand.mockResolvedValue(null);
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: '등록된 브랜드가 없습니다' })).toBeVisible();
    await waitFor(() => expect(apiMocks.getFeaturedBrand).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: '이달의 브랜드' })).not.toBeInTheDocument();
  });

  it('renders the spotlight from the featured brand with links to its detail page', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const spotlight = await screen.findByRole('region', { name: '이달의 브랜드' });
    expect(within(spotlight).getAllByText('이달브랜드').length).toBeGreaterThan(0);
    expect(within(spotlight).getByRole('link', { name: /브랜드관 보기/ })).toHaveAttribute(
      'href',
      '/brands/brd-featured',
    );
  });

  it('retries a temporary failure and then shows the directory', async () => {
    const user = userEvent.setup();
    apiMocks.listBrands
      .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
      .mockResolvedValueOnce(directoryBrands);
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드를 불러오지 못했습니다');
    await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('navigation', { name: '브랜드 색인' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가브랜드, 제품 3개' })).toHaveAttribute(
      'href',
      '/brands/brd-g0',
    );
  });

  it('shows the not-implemented notice without a retry button', async () => {
    apiMocks.listBrands.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.list'));
    apiMocks.getFeaturedBrand.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'featured'));
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
    expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
    // 이달의 브랜드 실패는 밴드만 숨깁니다.
    expect(screen.queryByRole('region', { name: '이달의 브랜드' })).not.toBeInTheDocument();
  });

  it('disables index keys without brands and expands up to the chosen group', async () => {
    const user = userEvent.setup();
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const brandIndex = await screen.findByRole('navigation', { name: '브랜드 색인' });
    expect(within(brandIndex).getByText('ㄴ')).toHaveAttribute('aria-disabled', 'true');
    expect(within(brandIndex).getByText('#')).toHaveAttribute('aria-disabled', 'true');
    expect(within(brandIndex).getByRole('link', { name: '전체' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    // 처음에는 12개만 보여서 A–Z 묶음의 뒤쪽 브랜드는 아직 없습니다.
    expect(screen.queryByRole('link', { name: 'Echo, 제품 3개' })).not.toBeInTheDocument();

    const latinKey = within(brandIndex).getByRole('link', { name: 'A–Z' });
    expect(latinKey).toHaveAttribute('href', '#brand-group-en');
    await user.click(latinKey);

    expect(screen.getByRole('link', { name: 'Echo, 제품 3개' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /A–Z/ })).toHaveFocus();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
    expect(latinKey).toHaveAttribute('aria-current', 'location');
    // 모두 펼쳐져서 더 보기 버튼이 사라집니다.
    expect(screen.queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
  });

  it('reveals the next brands with More, moves focus to the first new brand, then hides More', async () => {
    const user = userEvent.setup();
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const showMoreButton = await screen.findByRole('button', { name: '더 보기 (12/15)' });
    expect(screen.getAllByRole('link', { name: /, 제품 3개$/ })).toHaveLength(12);
    await user.click(showMoreButton);

    expect(screen.getAllByRole('link', { name: /, 제품 3개$/ })).toHaveLength(15);
    expect(screen.getByRole('link', { name: 'Charlie, 제품 3개' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
  });
});
