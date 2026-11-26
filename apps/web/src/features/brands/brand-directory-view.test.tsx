import { ApiError } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandDirectoryView } from './brand-directory-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listBrands: vi.fn(),
  getBrandById: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

// 타일은 브랜드 페이지 링크이므로, 실제 라우터 없이 href만 확인하도록 앵커로 바꿉니다.
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

const INTRO_TEXT = '현장에서 검증한 안전용품 브랜드를 한곳에 모았습니다.';

function buildBrandSummary(
  brandId: string,
  name: string,
  overrides: Partial<BrandSummary> = {},
): BrandSummary {
  return {
    id: brandId,
    name,
    englishName: `${name} EN`,
    logoUrl: null,
    tagline: `${name} 소개입니다.`,
    productCount: 1,
    ...overrides,
  };
}

const brandOne = buildBrandSummary('brand-one', '한결&안전');
const brandTwo = buildBrandSummary('brand-two', '세이프원');
const brands = [brandOne, brandTwo];

function renderDirectory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <BrandDirectoryView />
    </QueryClientProvider>,
  );
  return { ...renderResult, queryClient };
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows every brand as a link to its brand page, with no selection, spotlight, or 제품 보기', async () => {
    renderDirectory();

    const firstTile = await screen.findByRole('link', { name: '한결&안전, 제품 1개' });
    expect(firstTile).toHaveAttribute('href', '/brands/brand-one');
    expect(screen.getByRole('link', { name: '세이프원, 제품 1개' })).toHaveAttribute(
      'href',
      '/brands/brand-two',
    );
    expect(screen.queryByRole('link', { name: '제품 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '한결&안전' })).not.toBeInTheDocument();
  });

  it('keeps the title block with the brand count and the intro text', async () => {
    renderDirectory();

    expect(await screen.findByText('브랜드 2개')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
    expect(screen.getByText(INTRO_TEXT)).toBeVisible();
  });

  it('does not request brand details or product lists on the list page', async () => {
    renderDirectory();

    await screen.findByRole('link', { name: '한결&안전, 제품 1개' });
    expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('moves focus from one brand tile to the next with a single Tab stop per brand', async () => {
    const user = userEvent.setup();
    renderDirectory();

    // jsdom은 CSS 숨김을 적용하지 않아 모바일에서 숨겨진 빵부스러기 링크도 탭 순서에 들어갑니다. 타일끼리의 순서만 봅니다.
    const firstTile = await screen.findByRole('link', { name: '한결&안전, 제품 1개' });
    firstTile.focus();
    await user.tab();
    expect(screen.getByRole('link', { name: '세이프원, 제품 1개' })).toHaveFocus();
  });

  it('shows a busy placeholder while the brands load', () => {
    apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
    const { container } = renderDirectory();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /제품 \d+개$/ })).not.toBeInTheDocument();
  });

  it('shows a danger alert with a retry button only for a temporary failure and reloads the grid', async () => {
    const user = userEvent.setup();
    apiMocks.listBrands
      .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
      .mockResolvedValueOnce(brands);
    renderDirectory();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드를 불러오지 못했습니다');
    await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('link', { name: '한결&안전, 제품 1개' })).toBeVisible();
  });

  it('shows the not-implemented notice without a retry button', async () => {
    apiMocks.listBrands.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.list'));
    renderDirectory();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
    expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no brands', async () => {
    apiMocks.listBrands.mockResolvedValue([]);
    renderDirectory();

    expect(await screen.findByText('등록된 브랜드가 없습니다')).toBeVisible();
    expect(screen.queryByRole('link', { name: /제품 \d+개$/ })).not.toBeInTheDocument();
  });

  it('keeps the list in sync when the refetched brand list changes a product count', async () => {
    const { queryClient } = renderDirectory();
    await screen.findByRole('link', { name: '한결&안전, 제품 1개' });

    apiMocks.listBrands.mockResolvedValue([
      buildBrandSummary('brand-one', '한결&안전', { productCount: 4 }),
      brandTwo,
    ]);
    await queryClient.refetchQueries({ queryKey: queryKeys.brands.list });

    expect(await screen.findByRole('link', { name: '한결&안전, 제품 4개' })).toBeVisible();
  });
});
