import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './site-header';

const MENU_TRANSITION_DURATION_MS = 160;

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
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
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

  it('shows one current menu link without a success tint when multiple links share its route', async () => {
    navigationMocks.pathname = '/about';
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const currentLinks = within(menu).getAllByRole('link', { current: 'page' });

    expect(within(menu).queryByRole('heading', { name: '전체 메뉴' })).not.toBeInTheDocument();
    expect(within(menu).queryByText('고객센터')).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: '이용 안내' })).not.toBeInTheDocument();
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveAccessibleName('개요');
    expect(currentLinks[0]).toHaveClass('text-success', 'underline');
    expect(currentLinks[0]).not.toHaveClass('bg-success-tint');
    const inactiveLink = within(menu).getByRole('link', { name: '사업분야' });
    expect(inactiveLink).not.toHaveAttribute('aria-current');
    expect(inactiveLink).toHaveClass('text-text-2');
    expect(inactiveLink).not.toHaveClass('bg-success-tint');
    expect(within(menu).getByRole('button', { name: '전체 메뉴 닫기' })).toHaveClass('size-44');
  });

  it('keeps the current FAQ link green and underlined without a green background', async () => {
    navigationMocks.pathname = '/support/faq';
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    await user.click(desktopMenuButton);

    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const supportSection = within(menu).getByRole('region', { name: '고객지원' });
    const supportToggle = within(supportSection).getByRole('button', { name: '고객지원' });
    expect(supportToggle).toHaveAttribute('aria-expanded', 'true');
    const supportContentId = supportToggle.getAttribute('aria-controls');
    if (!supportContentId) throw new Error('고객지원 메뉴 콘텐츠 ID가 없습니다.');
    const supportContent = document.getElementById(supportContentId);
    if (!supportContent) throw new Error('고객지원 메뉴 콘텐츠를 찾을 수 없습니다.');
    expect(supportContent).toHaveAttribute('aria-hidden', 'false');
    expect(supportToggle).toHaveClass('border-success', 'text-success');

    const faqLink = within(supportSection).getByRole('link', { name: 'FAQ' });
    expect(faqLink).toHaveAttribute('href', '/support/faq');
    expect(faqLink).toHaveAttribute('aria-current', 'page');
    expect(faqLink).toHaveClass('focus-ring');
    expect(faqLink).toHaveClass('text-success');
    expect(faqLink).toHaveClass('underline', 'decoration-success', 'underline-offset-4');
    expect(faqLink).not.toHaveClass('bg-success-tint');
    expect(faqLink).not.toHaveClass('hover:bg-success-tint');
    expect(faqLink).not.toHaveClass('active:bg-success-tint');
    faqLink.focus();
    expect(faqLink).toHaveFocus();

    for (const label of ['공지사항', '1:1 문의']) {
      const inactiveLink = within(supportSection).getByRole('link', { name: label });
      expect(inactiveLink).not.toHaveAttribute('aria-current');
      expect(inactiveLink).toHaveClass(
        'text-text-2',
        'hover:bg-surface',
        'hover:text-text-1',
        'active:bg-surface-2',
      );
    }
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
    expect(ancestorCategoryLink).toHaveClass('text-success', 'underline');
    expect(ancestorCategoryLink).not.toHaveClass('bg-success-tint');
    expect(within(menu).getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it.each([
    ['desktop', 1280, 0],
    ['mobile', 390, 1],
  ] as const)(
    'closes the popup with Escape and restores the %s trigger focus',
    async (_viewport, width, triggerIndex) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      const user = userEvent.setup();
      render(<SiteHeader />, { wrapper: createWrapper() });

      const menuTriggers = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
      const menuTrigger = menuTriggers[triggerIndex];
      if (!menuTrigger) throw new Error('메뉴 버튼을 찾을 수 없습니다.');
      await user.click(menuTrigger);
      await screen.findByRole('navigation', { name: '전체 메뉴' });
      const menuPanel = document.getElementById('site-header-all-menu');
      if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
      expect(menuPanel).not.toHaveAttribute('aria-modal');
      expect(document.body).not.toHaveAttribute('inert');
      expect(document.body.style.overflow).not.toBe('hidden');
      const closeButton = within(screen.getByRole('navigation', { name: '전체 메뉴' })).getByRole(
        'button',
        { name: '전체 메뉴 닫기' },
      );
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
      expect(menuTrigger).toHaveFocus();
    },
  );

  it('restores focus to the mobile menu trigger after the viewport narrows', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton, mobileMenuButton] = screen.getAllByRole('button', {
      name: '전체 메뉴 열기',
    });
    if (!desktopMenuButton || !mobileMenuButton) {
      throw new Error('메뉴 버튼을 찾을 수 없습니다.');
    }
    await user.click(desktopMenuButton);
    await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    fireEvent.resize(window);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
    expect(desktopMenuButton).not.toHaveFocus();
    expect(mobileMenuButton).toHaveFocus();
  });

  it('restores focus to the product back button when no mobile menu trigger exists', async () => {
    navigationMocks.pathname = '/products/product-1';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!desktopMenuButton) {
      throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
    }
    await user.click(desktopMenuButton);
    await screen.findByRole('navigation', { name: '전체 메뉴' });
    const menuPanel = document.getElementById('site-header-all-menu');
    if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    fireEvent.resize(window);
    const backButton = screen.getByRole('button', { name: '이전 화면' });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(menuPanel).toHaveAttribute('aria-hidden', 'true'));
    expect(desktopMenuButton).not.toHaveFocus();
    expect(backButton).toHaveFocus();
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

  it('keeps the panel mounted when it reopens before the exit animation ends', () => {
    vi.useFakeTimers();
    const { unmount } = render(<SiteHeader />, { wrapper: createWrapper() });

    try {
      const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
      if (!desktopMenuButton) throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
      fireEvent.click(desktopMenuButton);
      const menuPanel = document.getElementById('site-header-all-menu');
      if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');

      act(() => vi.advanceTimersByTime(32));
      act(() => vi.advanceTimersByTime(MENU_TRANSITION_DURATION_MS));
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');

      fireEvent.click(desktopMenuButton);
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');
      expect(menuPanel).toHaveAttribute('inert');
      expect(menuPanel).toHaveClass('opacity-0');
      expect(menuPanel).toHaveStyle({ translate: '-50% calc(-50% - 8px)' });
      fireEvent.click(desktopMenuButton);
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');

      act(() => vi.advanceTimersByTime(MENU_TRANSITION_DURATION_MS - 1));
      expect(menuPanel).toBeInTheDocument();
      expect(menuPanel).not.toHaveAttribute('hidden');
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');

      act(() => vi.advanceTimersByTime(1));
      expect(menuPanel).toBeInTheDocument();
      expect(menuPanel).not.toHaveAttribute('hidden');
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('keeps the entering popup hidden and inactive until its motion completes', () => {
    vi.useFakeTimers();
    const { unmount } = render(<SiteHeader />, { wrapper: createWrapper() });

    try {
      const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
      if (!desktopMenuButton) throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
      desktopMenuButton.focus();
      fireEvent.click(desktopMenuButton);

      const menuPanel = document.getElementById('site-header-all-menu');
      if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');

      expect(desktopMenuButton).toHaveFocus();
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');
      expect(menuPanel).toHaveAttribute('inert');
      expect(menuPanel).toHaveClass('pointer-events-none');
      expect(screen.queryByRole('navigation', { name: '전체 메뉴' })).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(32));
      expect(menuPanel).toHaveAttribute('data-menu-motion-state', 'open');
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');
      expect(menuPanel).toHaveAttribute('inert');

      act(() => vi.advanceTimersByTime(MENU_TRANSITION_DURATION_MS - 1));
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');
      act(() => vi.advanceTimersByTime(1));
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');
      expect(menuPanel).not.toHaveAttribute('inert');
      expect(menuPanel).not.toHaveClass('pointer-events-none');
      expect(screen.getByRole('navigation', { name: '전체 메뉴' })).toBeInTheDocument();
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('opens immediately without entry motion when reduced motion is preferred', () => {
    vi.useFakeTimers();
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame');
    const { unmount } = render(<SiteHeader />, { wrapper: createWrapper() });
    requestAnimationFrame.mockClear();

    try {
      const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
      if (!desktopMenuButton) throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
      fireEvent.click(desktopMenuButton);

      const menuPanel = document.getElementById('site-header-all-menu');
      if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');
      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(menuPanel).toHaveAttribute('data-menu-motion-state', 'open');
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');
      expect(menuPanel).not.toHaveAttribute('inert');
      expect(menuPanel).not.toHaveClass('pointer-events-none');
      expect(menuPanel).toHaveClass('opacity-100');
      expect(menuPanel).toHaveStyle({ translate: '-50% -50%' });
      expect(screen.getByRole('navigation', { name: '전체 메뉴' })).toBeInTheDocument();
    } finally {
      unmount();
      requestAnimationFrame.mockRestore();
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      } else {
        Reflect.deleteProperty(window, 'matchMedia');
      }
      vi.useRealTimers();
    }
  });

  it('enables the popup as soon as a mid-close reverse transition ends', () => {
    vi.useFakeTimers();
    const { unmount } = render(<SiteHeader />, { wrapper: createWrapper() });

    try {
      const [desktopMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
      if (!desktopMenuButton) throw new Error('데스크톱 메뉴 버튼을 찾을 수 없습니다.');
      fireEvent.click(desktopMenuButton);
      const menuPanel = document.getElementById('site-header-all-menu');
      if (!menuPanel) throw new Error('전체 메뉴 패널을 찾을 수 없습니다.');

      act(() => vi.advanceTimersByTime(32));
      fireEvent.transitionEnd(menuPanel, { propertyName: 'opacity' });
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');

      fireEvent.click(desktopMenuButton);
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');
      act(() => vi.advanceTimersByTime(MENU_TRANSITION_DURATION_MS / 2));
      fireEvent.click(desktopMenuButton);
      expect(menuPanel).toHaveAttribute('data-menu-motion-state', 'open');
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');
      expect(menuPanel).toHaveAttribute('inert');

      const menuNavigation = menuPanel.querySelector('nav');
      if (!menuNavigation) throw new Error('전체 메뉴 탐색 영역을 찾을 수 없습니다.');
      fireEvent.transitionEnd(menuNavigation, { propertyName: 'opacity' });
      expect(menuPanel).toHaveAttribute('aria-hidden', 'true');

      fireEvent.transitionEnd(menuPanel, { propertyName: 'opacity' });
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');
      expect(menuPanel).not.toHaveAttribute('inert');

      act(() => vi.advanceTimersByTime(MENU_TRANSITION_DURATION_MS));
      expect(menuPanel).toBeInTheDocument();
      expect(menuPanel).toHaveAttribute('aria-hidden', 'false');
    } finally {
      unmount();
      vi.useRealTimers();
    }
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
    expect(within(menu).getByRole('link', { name: 'FAQ' })).toBeInTheDocument();
    expect(within(menu).queryByText('고객센터')).not.toBeInTheDocument();

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
    const menuMotion = menuPanel;
    await waitFor(() => expect(menuMotion).toHaveAttribute('data-menu-motion-state', 'open'));
    expect(menuMotion).toHaveClass('opacity-100');
    expect(menuMotion).toHaveStyle({ translate: '-50% -50%' });
    expect(menu.querySelector('[class~="lg:grid-cols-5"]')).toBeInTheDocument();
    for (const sectionTitle of ['제품', '브랜드', '안전 솔루션', '고객지원', '회사소개']) {
      expect(within(menu).getByRole('button', { name: sectionTitle })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    }
    expect(menuPanel).toHaveClass(
      'fixed',
      'top-1/2',
      'left-1/2',
      'w-[calc(100%_-_32px)]',
      'max-w-[1200px]',
      'max-h-[calc(100dvh-32px)]',
    );
    expect(menuPanel.classList.contains('lg:w-[calc(100%_-_48px)]')).toBe(true);
    expect(menuPanel).toHaveClass('lg:max-h-[calc(100dvh-48px)]');
    expect(menuPanel).toHaveStyle({ translate: '-50% -50%' });
    expect(menuPanel).toHaveClass(
      'transition-[opacity,translate]',
      'ease-out',
      'motion-reduce:transition-none',
    );
    expect(menuPanel).toHaveStyle({
      transitionDuration: '160ms',
    });
    expect(menuPanel.closest('header')).toHaveClass('z-50');
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
    expect(menuPanel).toHaveClass(
      'fixed',
      'top-1/2',
      'left-1/2',
      'w-[calc(100%_-_32px)]',
      'max-h-[calc(100dvh-32px)]',
    );
    const sectionTitles = ['제품', '브랜드', '안전 솔루션', '고객지원', '회사소개'];
    for (const sectionTitle of sectionTitles) {
      expect(within(menu).getByRole('button', { name: sectionTitle })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }

    const productColumn = within(menu).getByRole('region', { name: '제품' });
    const productDisclosure = within(productColumn).getByRole('button', { name: '제품' });
    const productContents = document.getElementById(
      productDisclosure.getAttribute('aria-controls') ?? '',
    );
    if (!productContents) throw new Error('제품 메뉴 콘텐츠를 찾을 수 없습니다.');
    expect(productDisclosure).toHaveClass('min-h-44');
    expect(productContents).toHaveAttribute('aria-hidden', 'true');
    expect(productContents).toHaveAttribute('inert');
    await user.click(productDisclosure);
    await waitFor(() => expect(productDisclosure).toHaveAttribute('aria-expanded', 'true'));
    expect(within(productColumn).getByRole('link', { name: '전체 제품' })).toBeVisible();
    expect(productContents).toHaveClass(
      'transition-[grid-template-rows]',
      'duration-[180ms]',
      'ease-out',
      'motion-reduce:transition-none',
    );

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    fireEvent.resize(window);
    expect(productDisclosure).toHaveAttribute('aria-expanded', 'true');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    fireEvent.resize(window);
    await waitFor(() => expect(productDisclosure).toHaveAttribute('aria-expanded', 'true'));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    fireEvent.resize(window);
    await waitFor(() => expect(productDisclosure).toHaveAttribute('aria-expanded', 'false'));
    expect(productContents).toHaveAttribute('aria-hidden', 'true');
    expect(productContents).toHaveAttribute('inert');
    expect(within(productColumn).queryByRole('link', { name: '전체 제품' })).toBeNull();
  });

  it.each(['제품', '브랜드', '안전 솔루션', '고객지원', '회사소개'])(
    'toggles the %s category with accessible animated content',
    async (sectionTitle) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      const user = userEvent.setup();
      render(<SiteHeader />, { wrapper: createWrapper() });
      const [, mobileMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
      if (!mobileMenuButton) throw new Error('모바일 메뉴 버튼을 찾을 수 없습니다.');
      await user.click(mobileMenuButton);
      const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
      const section = within(menu).getByRole('region', { name: sectionTitle });
      const disclosureButton = within(section).getByRole('button', { name: sectionTitle });
      const sectionContentId = disclosureButton.getAttribute('aria-controls');
      if (!sectionContentId) throw new Error(`${sectionTitle} 메뉴 콘텐츠 ID가 없습니다.`);
      const sectionContent = document.getElementById(sectionContentId);
      if (!sectionContent) throw new Error(`${sectionTitle} 메뉴 콘텐츠를 찾을 수 없습니다.`);

      expect(disclosureButton).toHaveAttribute('aria-expanded', 'false');
      expect(sectionContent).toHaveAttribute('aria-hidden', 'true');
      expect(sectionContent).toHaveAttribute('inert');
      await user.click(disclosureButton);
      expect(disclosureButton).toHaveAttribute('aria-expanded', 'true');
      expect(sectionContent).toHaveAttribute('aria-hidden', 'false');
      expect(within(section).getAllByRole('link').length).toBeGreaterThan(0);
      await user.click(disclosureButton);
      expect(disclosureButton).toHaveAttribute('aria-expanded', 'false');
      expect(sectionContent).toHaveAttribute('aria-hidden', 'true');
      expect(within(section).queryAllByRole('link')).toHaveLength(0);
    },
  );

  it('keeps collapsed category links out of focus and the accessibility tree', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });
    const [, mobileMenuButton] = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    if (!mobileMenuButton) throw new Error('모바일 메뉴 버튼을 찾을 수 없습니다.');
    await user.click(mobileMenuButton);
    const menu = await screen.findByRole('navigation', { name: '전체 메뉴' });
    const supportSection = within(menu).getByRole('region', { name: '고객지원' });
    const supportToggle = within(supportSection).getByRole('button', { name: '고객지원' });
    const supportContentId = supportToggle.getAttribute('aria-controls');
    if (!supportContentId) throw new Error('고객지원 메뉴 콘텐츠 ID가 없습니다.');
    const supportContent = document.getElementById(supportContentId);

    await user.click(supportToggle);
    const faqLink = within(supportSection).getByRole('link', { name: 'FAQ' });
    faqLink.focus();
    expect(faqLink).toHaveFocus();

    fireEvent.click(supportToggle);

    expect(supportToggle).toHaveAttribute('aria-expanded', 'false');
    expect(supportToggle).toHaveFocus();
    expect(supportContent).toHaveAttribute('aria-hidden', 'true');
    expect(supportContent).toHaveAttribute('inert');
    expect(within(supportSection).queryByRole('link', { name: 'FAQ' })).toBeNull();
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
