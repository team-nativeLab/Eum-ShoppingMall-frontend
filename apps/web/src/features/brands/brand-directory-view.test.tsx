import { ApiError } from '@eum/api/errors';
import type { Brand, BrandSummary, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

function buildBrand(brandId: string, name: string): Brand {
  return {
    ...buildBrandSummary(brandId, name),
    coverImageUrl: null,
    mainField: '안전화·작업화',
    originCountry: '대한민국',
    certification: 'KCs 안전인증',
    story: null,
  };
}

const product: Product = {
  id: 'product-one',
  name: '작업 안전화',
  brand: '한결안전',
  categoryId: 'safety-shoes',
  price: 10000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '현장용 안전화입니다.',
  modelName: null,
  images: [],
  options: [],
  specifications: [],
  certifications: [],
  shipping: {
    method: '일반 배송',
    estimate: '2~3일 이내 출고',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '',
  },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  isFeatured: false,
};

const brands = [
  { ...buildBrandSummary('brand-one', '한결안전'), accentColor: '#466B9A' },
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

const originalViewportWidth = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function setCardRect(button: HTMLElement, left: number, width = 200) {
  const card = button.parentElement;
  if (!card) throw new Error('브랜드 카드 항목을 찾지 못했습니다.');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: 100,
    top: 100,
    left,
    right: left + width,
    bottom: 300,
    width,
    height: 200,
    toJSON: () => ({}),
  });
}

describe('BrandDirectoryView', () => {
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalViewportWidth,
    });
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    apiMocks.getShopApi.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      brands: { list: apiMocks.listBrands, getById: apiMocks.getBrandById },
      products: { list: apiMocks.listProducts },
    });
    apiMocks.listBrands.mockReset().mockResolvedValue(brands);
    apiMocks.getBrandById
      .mockReset()
      .mockImplementation(async (id: string) =>
        buildBrand(id, brands.find((brand) => brand.id === id)?.name ?? '한결안전'),
      );
    apiMocks.listProducts.mockReset().mockResolvedValue({
      page: 1,
      pageSize: 3,
      totalCount: 1,
      items: [product],
    });
  });

  it('shows a busy placeholder while brands load', () => {
    apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
    const { container } = render(<BrandDirectoryView />, { wrapper: createWrapper() });
    expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no visible brands', async () => {
    apiMocks.listBrands.mockResolvedValue([]);
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    expect(await screen.findByRole('heading', { name: '등록된 브랜드가 없습니다' })).toBeVisible();
    expect(apiMocks.getBrandById).not.toHaveBeenCalled();
  });

  it('shows every visible brand as a card and opens its selection panel', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const firstBrandButton = await screen.findByRole('button', { name: /한결안전.*1개/ });
    expect(screen.getByRole('button', { name: /세이프원.*1개/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '브랜드 색인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByText('이달의 브랜드')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /자세히 보기/ })).not.toBeInTheDocument();
    expect(firstBrandButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();

    fireEvent.pointerEnter(firstBrandButton.parentElement!, { pointerType: 'mouse' });
    expect(firstBrandButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstBrandButton).toHaveStyle({ borderColor: '#466B9A' });
    expect(screen.getByRole('complementary', { name: '한결안전' })).toHaveClass('rounded-24');
    expect(screen.getByRole('complementary', { name: '한결안전' }).firstElementChild).toHaveStyle({
      backgroundColor: '#466B9A',
    });
    expect(screen.getByText('한결안전 소개입니다.')).not.toHaveClass('opacity-80');
    expect(screen.getByRole('link', { name: /브랜드관 바로가기/ })).toHaveStyle({
      backgroundColor: '#466B9A',
    });

    const secondBrandButton = screen.getByRole('button', { name: /세이프원.*1개/ });
    fireEvent.pointerEnter(secondBrandButton.parentElement!, { pointerType: 'mouse' });
    expect(secondBrandButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstBrandButton).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findByRole('heading', { name: '세이프원' })).toBeInTheDocument();
    expect(await screen.findByText('안전화·작업화')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /브랜드관 바로가기/ })).toHaveAttribute(
      'href',
      '/brands/brand-two',
    );
    expect(screen.getByRole('complementary', { name: '세이프원' })).toHaveClass('absolute');
  });

  it('shows recommended products and keeps hidden-price display rules', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    const card = await screen.findByRole('button', { name: /한결안전.*1개/ });
    fireEvent.pointerEnter(card.parentElement!, { pointerType: 'mouse' });
    const productLink = await screen.findByRole('link', { name: /작업 안전화.*₩10,000/ });
    expect(productLink).toHaveAttribute('href', '/products/product-one');
    expect(within(productLink).queryByRole('img', { name: '작업 안전화' })).not.toBeInTheDocument();
  });

  it('uses an AA-compliant black foreground when neither standard foreground passes', async () => {
    apiMocks.listBrands.mockResolvedValue([
      { ...buildBrandSummary('brand-white-boundary', '밝은 경계'), accentColor: '#767676' },
      { ...buildBrandSummary('brand-black-boundary', '어두운 경계'), accentColor: '#777777' },
    ]);
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const lightButton = await screen.findByRole('button', { name: /밝은 경계.*1개/ });
    fireEvent.pointerEnter(lightButton.parentElement!, { pointerType: 'mouse' });
    await screen.findByText('밝은 경계 EN');
    expect(screen.getByRole('complementary', { name: '밝은 경계' }).firstElementChild).toHaveClass(
      'text-inverse',
    );
    const darkButton = screen.getByRole('button', { name: /어두운 경계.*1개/ });
    fireEvent.pointerEnter(darkButton.parentElement!, { pointerType: 'mouse' });
    await screen.findByText('어두운 경계 EN');
    const darkAccentHeader = screen.getByRole('complementary', {
      name: '어두운 경계',
    }).firstElementChild;
    expect(darkAccentHeader).toHaveClass('text-text-accent-black');
    expect(darkAccentHeader).toHaveStyle({ color: 'var(--color-text-accent-black)' });
    expect(screen.getByText('어두운 경계 소개입니다.')).not.toHaveClass('opacity-80');
  });

  it('retries a temporary brand list failure', async () => {
    const user = userEvent.setup();
    apiMocks.listBrands
      .mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'))
      .mockResolvedValueOnce(brands);
    render(<BrandDirectoryView />, { wrapper: createWrapper() });

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드를 불러오지 못했습니다');
    await user.click(within(errorAlert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('button', { name: /한결안전.*1개/ })).toBeInTheDocument();
  });

  it('shows the not-implemented notice without a retry button', async () => {
    apiMocks.listBrands.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.list'));
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
    expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the panel open while the pointer crosses the visual gap into the panel', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    const button = await screen.findByRole('button', { name: /한결안전.*1개/ });
    const card = button.parentElement!;
    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    const bridge = card.querySelector<HTMLElement>('[data-brand-panel-bridge]')!;
    expect(bridge).toHaveClass('h-8', 'lg:h-16');
    fireEvent.pointerLeave(card, { pointerType: 'mouse', relatedTarget: bridge });
    fireEvent.pointerEnter(bridge, { pointerType: 'mouse' });
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
    fireEvent.pointerLeave(bridge, {
      pointerType: 'mouse',
      relatedTarget: screen.getByRole('complementary', { name: '한결안전' }),
    });
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
  });

  it('does not pin a panel after mouse click focus when the pointer exits', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    const button = await screen.findByRole('button', { name: /한결안전.*1개/ });
    const card = button.parentElement!;
    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    fireEvent.pointerDown(button, { pointerType: 'mouse' });
    fireEvent.focus(button);
    fireEvent.pointerUp(button, { pointerType: 'mouse' });
    fireEvent.pointerLeave(card, { pointerType: 'mouse', relatedTarget: document.body });
    expect(screen.queryByRole('complementary', { name: '한결안전' })).not.toBeInTheDocument();
  });

  it('opens for keyboard focus and stays open while Tab moves into a panel link', async () => {
    const user = userEvent.setup();
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    const button = await screen.findByRole('button', { name: /한결안전.*1개/ });
    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
    const productLink = await screen.findByRole('link', { name: /작업 안전화.*₩10,000/ });
    await user.tab();
    expect(productLink).toHaveFocus();
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /브랜드관 바로가기/ });
    link.focus();
    expect(link).toHaveFocus();
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
    fireEvent.blur(link, { relatedTarget: document.body });
    expect(screen.queryByRole('complementary', { name: '한결안전' })).not.toBeInTheDocument();
  });

  it('opens and toggles on touch, then permits keyboard focus after pointer cancellation', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    const button = await screen.findByRole('button', { name: /한결안전.*1개/ });
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.pointerUp(button, { pointerType: 'touch' });
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.pointerUp(button, { pointerType: 'touch' });
    expect(screen.queryByRole('complementary', { name: '한결안전' })).not.toBeInTheDocument();

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.pointerCancel(button, { pointerType: 'touch' });
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole('complementary', { name: '한결안전' })).toBeInTheDocument();
  });

  it('flips right-edge panels, clamps both narrow viewport edges, and recalculates on resize', async () => {
    render(<BrandDirectoryView />, { wrapper: createWrapper() });
    setViewportWidth(1440);
    const rightButton = await screen.findByRole('button', { name: /세이프원.*1개/ });
    setCardRect(rightButton, 1260);
    fireEvent.pointerEnter(rightButton.parentElement!, { pointerType: 'mouse' });
    let bridge = rightButton.parentElement!.querySelector<HTMLElement>(
      '[data-brand-panel-bridge]',
    )!;
    expect(bridge).toHaveClass('right-0');
    expect(bridge).toHaveStyle({ width: '560px', right: '36px' });

    setViewportWidth(390);
    setCardRect(rightButton, 180);
    fireEvent(window, new Event('resize'));
    bridge = rightButton.parentElement!.querySelector<HTMLElement>('[data-brand-panel-bridge]')!;
    expect(bridge).toHaveStyle({ width: '358px', right: '6px' });

    const leftButton = screen.getByRole('button', { name: /한결안전.*1개/ });
    setCardRect(leftButton, 20);
    fireEvent.pointerEnter(leftButton.parentElement!, { pointerType: 'mouse' });
    bridge = leftButton.parentElement!.querySelector<HTMLElement>('[data-brand-panel-bridge]')!;
    expect(bridge).toHaveClass('left-0');
    expect(bridge).toHaveStyle({ width: '354px', left: '0px' });
  });
});
