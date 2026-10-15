import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './site-header';

const navigationMocks = vi.hoisted(() => ({
  pathname: '/',
  search: '',
  push: vi.fn(),
  back: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listProducts: vi.fn(),
  suggestProducts: vi.fn(),
  listBrands: vi.fn(),
  listCategories: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({ push: navigationMocks.push, back: navigationMocks.back }),
  useSearchParams: () => new URLSearchParams(navigationMocks.search),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...linkProps
  }: {
    href: string;
    children: ReactNode;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    [propName: string]: unknown;
  }) => (
    <a
      href={href}
      {...linkProps}
      onClick={(clickEvent) => {
        linkProps.onClick?.(clickEvent);
        clickEvent.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
vi.mock('./cart-link', () => ({ CartLink: () => <a href="/cart">장바구니</a> }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('SiteHeader product and brand navigation', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    navigationMocks.pathname = '/';
    navigationMocks.search = '';
    navigationMocks.push.mockReset();
    navigationMocks.back.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      products: { list: apiMocks.listProducts, suggest: apiMocks.suggestProducts },
      brands: { list: apiMocks.listBrands },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.listProducts.mockReset();
    apiMocks.suggestProducts.mockReset();
    apiMocks.suggestProducts.mockResolvedValue([]);
    apiMocks.listBrands.mockReset();
    apiMocks.listBrands.mockResolvedValue([
      {
        id: 'brd-3m',
        name: '3M',
        englishName: null,
        logoUrl: null,
        tagline: null,
        productCount: 1,
      },
    ]);
    apiMocks.listCategories.mockResolvedValue([]);
  });

  it('links Product to the full listing and Brand to /brands while both stay inactive at home', () => {
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });
    const productsLink = within(primaryNavigation).getByRole('link', { name: '제품' });
    const brandsLink = within(primaryNavigation).getByRole('link', { name: '브랜드' });

    expect(productsLink).toHaveAttribute('href', '/search');
    expect(brandsLink).toHaveAttribute('href', '/brands');
    expect(productsLink).not.toHaveAttribute('aria-current');
    expect(brandsLink).not.toHaveAttribute('aria-current');
  });

  it.each(['/brands', '/brands/brd-3m'])('activates only Brand on %s', (pathname) => {
    navigationMocks.pathname = pathname;
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });

    // 경로만으로 정하므로 첫 렌더부터 활성입니다(Suspense 대기 없음).
    expect(within(primaryNavigation).getByRole('link', { name: '브랜드' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(primaryNavigation).getByRole('link', { name: '제품' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it.each([
    ['/search', 'brand=3M'],
    ['/category/gloves', 'brand=3M'],
  ])('keeps Product active on %s?%s with a brand filter', (pathname, search) => {
    navigationMocks.pathname = pathname;
    navigationMocks.search = search;
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });

    expect(within(primaryNavigation).getByRole('link', { name: '제품' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(primaryNavigation).getByRole('link', { name: '브랜드' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('lists brand detail links from the brands API in the dropdown and keeps All brands', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    // 메뉴를 열기 전에는 브랜드를 조회하지 않습니다.
    expect(apiMocks.listBrands).not.toHaveBeenCalled();
    const menuButtons = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    expect(menuButtons).toHaveLength(2);
    const mobileMenuButton = menuButtons[1];
    if (!mobileMenuButton) throw new Error('모바일 메뉴 버튼을 찾을 수 없습니다.');
    await user.click(mobileMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });

    expect(within(menu).getByRole('link', { name: '전체 제품' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(within(menu).getByRole('link', { name: '전체 브랜드' })).toHaveAttribute(
      'href',
      '/brands',
    );
    expect(await within(menu).findByRole('link', { name: '3M' })).toHaveAttribute(
      'href',
      '/brands/brd-3m',
    );
    expect(apiMocks.listBrands).toHaveBeenCalledTimes(1);
    // 브랜드 목록을 위해 상품을 대량 조회하지 않습니다.
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('shows one current menu link with a success tint when multiple links share its route', async () => {
    navigationMocks.pathname = '/about';
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const currentLinks = within(menu).getAllByRole('link', { current: 'page' });

    expect(within(menu).getByRole('heading', { name: '전체 메뉴' })).toBeVisible();
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveAccessibleName('개요');
    expect(currentLinks[0]).toHaveClass('bg-success-tint', 'text-success');
    expect(within(menu).getByRole('button', { name: '전체 메뉴 닫기' })).toHaveClass('size-44');
  });

  it('activates the top-level category link for a nested category route', async () => {
    navigationMocks.pathname = '/category/safety-signs';
    apiMocks.listCategories.mockResolvedValue([
      {
        id: 'category-security',
        slug: 'security-monitoring',
        name: '보안·감시',
        parentId: null,
        description: null,
        iconKey: null,
      },
      {
        id: 'category-signs',
        slug: 'safety-signs',
        name: '안전 표지',
        parentId: 'category-security',
        description: null,
        iconKey: null,
      },
    ]);
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);

    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const ancestorCategoryLink = within(menu).getByRole('link', { name: '보안·감시' });
    expect(ancestorCategoryLink).toHaveAttribute('href', '/category/security-monitoring');
    expect(ancestorCategoryLink).toHaveAttribute('aria-current', 'page');
    expect(ancestorCategoryLink).toHaveClass('bg-success-tint', 'text-success');
    expect(within(menu).getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('closes the popup with Escape and restores focus without modal behavior', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
    expect(desktopMenuButton).toHaveFocus();
    expect(menuPanel).not.toHaveAttribute('aria-modal');
    expect(document.body).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).not.toBe('hidden');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
    expect(desktopMenuButton).toHaveFocus();
  });

  it('closes the popup from its X control and restores focus to its opener', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });
    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');

    await user.click(within(menu).getByRole('button', { name: '전체 메뉴 닫기' }));

    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
    expect(desktopMenuButton).toHaveFocus();
  });

  it('does not trap focus and closes the dropdown after choosing a link', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
    const firstLink = within(menu).getByRole('link', { name: '전체 제품' });
    firstLink.focus();
    await user.tab({ shift: true });
    expect(firstLink).not.toHaveFocus();
    expect(within(menu).getByRole('link', { name: '이용 안내' })).toBeInTheDocument();

    await user.click(within(menu).getByRole('link', { name: '전체 브랜드' }));

    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
  });

  it.each([
    ['loading', () => new Promise<never>(() => {})],
    ['error', () => Promise.reject(new Error('temporary brand failure'))],
  ])('keeps All brands in the all-menu while brands are %s', async (_stateName, loadBrands) => {
    apiMocks.listBrands.mockImplementation(loadBrands);
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });

    await waitFor(() => expect(apiMocks.listBrands).toHaveBeenCalled());
    const brandColumn = within(menu).getByRole('region', { name: '브랜드' });
    expect(within(brandColumn).getAllByRole('link')).toHaveLength(1);
    expect(within(brandColumn).getByRole('link', { name: '전체 브랜드' })).toHaveAttribute(
      'href',
      '/brands',
    );
  });

  it('opens the dropdown on the more button and closes it when the same button is clicked again', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });
    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
    expect(desktopMenuButton).toHaveAttribute('aria-controls', 'site-header-all-menu');
    expect(desktopMenuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(desktopMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
    expect(menuPanel).toHaveAttribute('data-state', 'open');
    expect(menu.querySelector('[class~="lg:grid-cols-5"]')).toBeInTheDocument();
    expect(menu.querySelector('details')).toHaveAttribute('open');
    expect(menuPanel).toHaveClass(
      'absolute',
      'top-full',
      'w-full',
      'duration-[160ms]',
      'motion-reduce:transition-none',
    );
    expect(desktopMenuButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(desktopMenuButton);
    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
    expect(desktopMenuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not open from product hover and supports the mobile click disclosure', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });
    const productLink = screen.getByRole('navigation', { name: '주요 메뉴' }).querySelector('a');
    if (!productLink) throw new Error('제품 메뉴 링크를 찾을 수 없습니다.');

    fireEvent.pointerEnter(productLink, { pointerType: 'mouse' });
    expect(document.getElementById('site-header-all-menu')).toHaveAttribute('aria-hidden', 'true');

    const [, mobileMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!mobileMenuButton) throw new Error('모바일 메뉴 버튼을 찾을 수 없습니다.');
    expect(mobileMenuButton).toHaveAttribute('aria-controls', 'site-header-all-menu');
    expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(mobileMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
    expect(menuPanel).toHaveAttribute('data-state', 'open');
    expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'true');
    expect(menu.querySelector('[class~="grid-cols-1"]')).toBeInTheDocument();
    const productColumn = within(menu).getByRole('region', { name: '제품' });
    const productDisclosure = productColumn.querySelector('details');
    const productSummary = productColumn.querySelector('summary');
    expect(productDisclosure).not.toHaveAttribute('open');
    expect(productSummary).toHaveClass('min-h-44');
    if (!productSummary || !productDisclosure) throw new Error('제품 메뉴 disclosure가 없습니다.');
    await user.click(productSummary);
    await waitFor(() => expect(productDisclosure).toHaveAttribute('open'));
    expect(within(productColumn).getByRole('link', { name: '전체 제품' })).toBeVisible();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    fireEvent.resize(window);
    expect(productDisclosure).toHaveAttribute('open');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    fireEvent.resize(window);
    await waitFor(() => expect(productDisclosure).toHaveAttribute('open'));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    fireEvent.resize(window);
    await waitFor(() => expect(productDisclosure).not.toHaveAttribute('open'));
  });

  it('closes the popup on outside click', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });
    const [, mobileMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!mobileMenuButton) throw new Error('모바일 메뉴 버튼을 찾을 수 없습니다.');
    await user.click(mobileMenuButton);
    await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
    const outsideLink = screen.getByRole('link', { name: '로그인' });

    await user.click(outsideLink);

    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
    expect(outsideLink).toHaveFocus();
  });

  it('closes the search suggestions when the popup opens and closes the popup when search opens', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    apiMocks.suggestProducts.mockResolvedValue([
      { productId: 'p1', name: '안전 장갑', brand: '브랜드' },
    ]);
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });
    const searchInput = screen.getByRole('combobox', { name: '상품 검색' });
    await user.type(searchInput, '안전');
    expect(await screen.findByRole('listbox', { name: '검색 자동완성' })).toBeVisible();

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 트리거를 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
    expect(screen.queryByRole('listbox', { name: '검색 자동완성' })).toBeNull();

    await user.click(searchInput);
    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
  });

  it('keeps the compact desktop header and removes scroll listeners on unmount', () => {
    navigationMocks.pathname = '/about';
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 9 });
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<SiteHeader />, { wrapper: createWrapper() });
    const header = screen.getByRole('banner');
    const desktopNavigationRow = header.querySelector('[class~="h-64"]');
    expect(desktopNavigationRow).toBeInTheDocument();
    expect(header).toHaveClass('shadow-1');

    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });
    const aboutLink = within(primaryNavigation).getByRole('link', { name: '회사소개' });
    expect(primaryNavigation).toHaveClass('h-full');
    for (const navigationLink of within(primaryNavigation).getAllByRole('link')) {
      expect(navigationLink).toHaveClass('h-full');
    }
    expect(aboutLink).toHaveAttribute('aria-current', 'page');
    expect(aboutLink).toHaveClass('after:bottom-0');

    const scrollHandler = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'scroll',
    )?.[1];
    const resizeHandler = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'resize',
    )?.[1];
    expect(scrollHandler).toBeTypeOf('function');
    expect(resizeHandler).toBeTypeOf('function');

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('scroll', scrollHandler);
    expect(removeEventListener).toHaveBeenCalledWith('resize', resizeHandler);

    if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    else Reflect.deleteProperty(window, 'innerWidth');
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    else Reflect.deleteProperty(window, 'scrollY');
  });
});
