import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
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
    [propName: string]: unknown;
  }) => (
    <a href={href} {...linkProps}>
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
    navigationMocks.pathname = '/';
    navigationMocks.search = '';
    navigationMocks.push.mockReset();
    navigationMocks.back.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      products: { list: apiMocks.listProducts },
      categories: { list: apiMocks.listCategories },
    });
    apiMocks.listProducts.mockResolvedValue({
      items: [{ brand: '3M' }],
      page: 1,
      pageSize: 100,
      totalCount: 1,
    });
    apiMocks.listCategories.mockResolvedValue([]);
  });

  it('links Product to the full listing and Brand to the brand browser while both stay inactive at home', () => {
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });
    const productsLink = within(primaryNavigation).getByRole('link', { name: '제품' });
    const brandsLink = within(primaryNavigation).getByRole('link', { name: '브랜드' });

    expect(productsLink).toHaveAttribute('href', '/search');
    expect(brandsLink).toHaveAttribute('href', '/search?browse=brands');
    expect(productsLink).not.toHaveAttribute('aria-current');
    expect(brandsLink).not.toHaveAttribute('aria-current');
  });

  it('activates Brand only when the search URL contains a selected brand filter', async () => {
    navigationMocks.pathname = '/search';
    navigationMocks.search = 'brand=3M&browse=brands';
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });

    await waitFor(() => {
      expect(within(primaryNavigation).getByRole('link', { name: '브랜드' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
    expect(within(primaryNavigation).getByRole('link', { name: '제품' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('activates only Brand when the search URL opens the brand browser without a selected filter', async () => {
    navigationMocks.pathname = '/search';
    navigationMocks.search = 'browse=brands';
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });

    await waitFor(() => {
      expect(within(primaryNavigation).getByRole('link', { name: '브랜드' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
    expect(within(primaryNavigation).getByRole('link', { name: '제품' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('activates only Brand when a selected brand filter is applied to a category route', async () => {
    navigationMocks.pathname = '/category/gloves';
    navigationMocks.search = 'brand=3M';
    render(<SiteHeader />, { wrapper: createWrapper() });
    const primaryNavigation = screen.getByRole('navigation', { name: '주요 메뉴' });

    await waitFor(() => {
      expect(within(primaryNavigation).getByRole('link', { name: '브랜드' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
    expect(within(primaryNavigation).getByRole('link', { name: '제품' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('uses brand filters for all products and brand-specific mobile menu links', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />, { wrapper: createWrapper() });

    const menuButtons = screen.getAllByRole('button', { name: '전체 메뉴 열기' });
    expect(menuButtons).toHaveLength(2);
    const mobileMenuButton = menuButtons[1];
    if (!mobileMenuButton) throw new Error('모바일 메뉴 버튼을 찾을 수 없습니다.');
    await user.click(mobileMenuButton);
    const menu = await screen.findByRole('dialog', { name: '전체 메뉴' });

    expect(within(menu).getByRole('link', { name: '전체 제품' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(within(menu).getByRole('link', { name: '전체 브랜드' })).toHaveAttribute(
      'href',
      '/search?browse=brands',
    );
    expect(await within(menu).findByRole('link', { name: '3M' })).toHaveAttribute(
      'href',
      '/search?brand=3M&browse=brands',
    );
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
