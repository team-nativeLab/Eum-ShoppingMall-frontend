import { ApiError } from '@eum/api/errors';
import type { BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandDirectoryView } from './brand-directory-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listBrands: vi.fn(),
  getBrandById: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
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

function buildBrandSummary(brandId: string, name: string): BrandSummary {
  return {
    id: brandId,
    name,
    englishName: `${name} EN`,
    logoUrl: null,
    tagline: `${name} 소개입니다.`,
    productCount: 1,
  };
}

const brands = [
  buildBrandSummary('brand-one', '한결&안전'),
  buildBrandSummary('brand-two', '세이프원'),
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderDirectory() {
  return render(<BrandDirectoryView />, { wrapper: createWrapper() });
}

describe('BrandDirectoryView', () => {
  beforeEach(() => {
    apiMocks.getShopApi.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      brands: { list: apiMocks.listBrands, getById: apiMocks.getBrandById },
      products: { list: apiMocks.listProducts },
    });
    apiMocks.listBrands.mockReset().mockResolvedValue(brands);
    apiMocks.getBrandById.mockReset();
    apiMocks.listProducts.mockReset();
  });

  it('shows a busy placeholder while brands load', () => {
    apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
    const { container } = renderDirectory();

    expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('shows an empty state when there are no visible brands', async () => {
    apiMocks.listBrands.mockResolvedValue([]);
    renderDirectory();

    expect(await screen.findByRole('heading', { name: '등록된 브랜드가 없습니다' })).toBeVisible();
    expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('links each brand card to the complete product listing filtered by brand', async () => {
    const user = userEvent.setup();
    renderDirectory();

    const firstBrandLink = await screen.findByRole('link', { name: '한결&안전, 제품 1개' });
    expect(screen.getByRole('link', { name: '세이프원, 제품 1개' })).toHaveAttribute(
      'href',
      '/search?brand=%EC%84%B8%EC%9D%B4%ED%94%84%EC%9B%90',
    );
    expect(firstBrandLink).toHaveAttribute(
      'href',
      '/search?brand=%ED%95%9C%EA%B2%B0%26%EC%95%88%EC%A0%84',
    );
    expect(firstBrandLink).toHaveClass('hover:border-line-strong', 'focus-ring');
    expect(firstBrandLink).toHaveAttribute('aria-label', '한결&안전, 제품 1개');

    fireEvent.pointerEnter(firstBrandLink, { pointerType: 'mouse' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByText('추천 상품')).not.toBeInTheDocument();
    expect(screen.queryByText('한결&안전 소개입니다.')).not.toBeInTheDocument();
    expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();

    await user.click(firstBrandLink);
    expect(firstBrandLink).toHaveAttribute(
      'href',
      '/search?brand=%ED%95%9C%EA%B2%B0%26%EC%95%88%EC%A0%84',
    );
  });

  it('retries a temporary brand list failure', async () => {
    const user = userEvent.setup();
    apiMocks.listBrands
      .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
      .mockResolvedValueOnce(brands);
    renderDirectory();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드를 불러오지 못했습니다');
    await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('link', { name: '한결&안전, 제품 1개' })).toBeInTheDocument();
  });

  it('shows the not-implemented notice without a retry button', async () => {
    apiMocks.listBrands.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.list'));
    renderDirectory();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
    expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
  });
});
