import { ApiError } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { Brand, BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBrandProductsHref } from '@/features/products/product-navigation';
import { DESKTOP_QUERY, REDUCED_MOTION_QUERY } from '@/lib/use-media-query';
import { BrandDirectoryView } from './brand-directory-view';
import { SPOTLIGHT_HEADER_OFFSET_PX, SPOTLIGHT_SCROLL_MARGIN_CLASS } from './brand-spotlight-band';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listBrands: vi.fn(),
  getBrandById: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

// 선택 브랜드는 URL 쿼리에 있으므로, replace가 쿼리를 바꾸면 useSearchParams가 새 값을 읽도록 작은 저장소로 흉내 냅니다.
const navigationMocks = vi.hoisted(() => {
  let currentQuery = new URLSearchParams();
  const listeners = new Set<() => void>();
  const setQuery = (nextQuery: URLSearchParams) => {
    currentQuery = nextQuery;
    listeners.forEach((listener) => listener());
  };
  return {
    replace: vi.fn((href: string) => {
      setQuery(new URLSearchParams(href.split('?')[1] ?? ''));
    }),
    getQuery: () => currentQuery,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setQuery,
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useRouter: () => ({ replace: navigationMocks.replace }),
    useSearchParams: () =>
      useSyncExternalStore(
        navigationMocks.subscribe,
        navigationMocks.getQuery,
        navigationMocks.getQuery,
      ),
  };
});
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

const DEFAULT_ACCENT_COLOR = '#2F6F62';
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

function buildBrandDetail(summary: BrandSummary, overrides: Partial<Brand> = {}): Brand {
  return {
    ...summary,
    coverImageUrl: null,
    mainField: '안전장비',
    originCountry: null,
    certification: null,
    story: null,
    ...overrides,
  };
}

const brandOne = buildBrandSummary('brand-one', '한결&안전');
const brandTwo = buildBrandSummary('brand-two', '세이프원');
const brands = [brandOne, brandTwo];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
}

function renderDirectory(queryClient = createTestQueryClient()) {
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <BrandDirectoryView />
    </QueryClientProvider>,
  );
  return { ...renderResult, queryClient };
}

/** 선택 브랜드 밴드(section, aria-labelledby의 제목 이름)를 찾습니다. */
function findSpotlightBand(brandName: string) {
  return screen.findByRole('region', { name: brandName });
}

/** 밴드 section의 화면 위치(getBoundingClientRect)를 고정합니다. */
function stubBandRect(band: HTMLElement, top: number, height: number) {
  vi.spyOn(band, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

/** 미디어 쿼리 문자열별로 matches를 줍니다. 목록에 없는 쿼리는 false입니다(기본은 모바일, 감속 모드 꺼짐). */
function stubMediaQueries(matchesByQuery: Record<string, boolean>) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matchesByQuery[query] ?? false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function stubReducedMotion(matches: boolean) {
  stubMediaQueries({ [REDUCED_MOTION_QUERY]: matches });
}

describe('BrandDirectoryView', () => {
  beforeEach(() => {
    navigationMocks.setQuery(new URLSearchParams());
    navigationMocks.replace.mockClear();
    stubReducedMotion(false);
    // jsdom에는 scrollIntoView가 없으므로 기본 스텁을 둡니다. 스크롤을 검사하는 테스트는 밴드별로 다시 바꿉니다.
    HTMLElement.prototype.scrollIntoView = vi.fn();
    apiMocks.getShopApi.mockReset();
    apiMocks.getShopApi.mockResolvedValue({
      brands: { list: apiMocks.listBrands, getById: apiMocks.getBrandById },
      products: { list: apiMocks.listProducts },
    });
    apiMocks.listBrands.mockReset().mockResolvedValue(brands);
    apiMocks.getBrandById.mockReset().mockImplementation(async (brandId: string) => {
      const summary = brands.find((brand) => brand.id === brandId);
      if (!summary) throw new ApiError('NOT_FOUND', brandId);
      return buildBrandDetail(summary);
    });
    apiMocks.listProducts.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('without a selected brand', () => {
    it('shows the grid of every brand with no spotlight, no search, and no index keys', async () => {
      renderDirectory();

      expect(await screen.findByRole('button', { name: '한결&안전, 제품 1개' })).toBeVisible();
      expect(screen.getByRole('button', { name: '세이프원, 제품 1개' })).toBeVisible();
      expect(screen.queryByRole('region', { name: '한결&안전' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: '세이프원' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: '브랜드 검색' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('group', { name: '브랜드 초성·알파벳 인덱스' }),
      ).not.toBeInTheDocument();
      expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    });

    it('keeps the visible title block with the brand count and the intro text', async () => {
      renderDirectory();

      expect(await screen.findByText('브랜드 2개')).toBeVisible();
      expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
      expect(screen.getByText(INTRO_TEXT)).toBeVisible();
    });

    it('does not select the first brand by default', async () => {
      renderDirectory();

      await screen.findByRole('button', { name: '한결&안전, 제품 1개' });
      expect(screen.getByRole('button', { name: '한결&안전, 제품 1개' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.getByRole('button', { name: '세이프원, 제품 1개' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(navigationMocks.replace).not.toHaveBeenCalled();
    });

    it('selects a brand card from the keyboard with Tab to focus and Enter to select', async () => {
      const user = userEvent.setup();
      renderDirectory();

      const secondCard = await screen.findByRole('button', { name: '세이프원, 제품 1개' });
      for (let step = 0; step < 20 && document.activeElement !== secondCard; step += 1) {
        await user.tab();
      }
      expect(secondCard).toHaveFocus();
      expect(secondCard).toHaveAttribute('aria-pressed', 'false');

      await user.keyboard('{Enter}');

      expect(secondCard).toHaveAttribute('aria-pressed', 'true');
      expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
    });

    it('renders each brand card as a button that selects the spotlight instead of navigating', async () => {
      const user = userEvent.setup();
      renderDirectory();

      const secondCard = await screen.findByRole('button', { name: '세이프원, 제품 1개' });
      expect(secondCard.tagName).toBe('BUTTON');
      expect(secondCard).not.toHaveAttribute('href');
      expect(screen.queryByRole('link', { name: '세이프원, 제품 1개' })).not.toBeInTheDocument();

      await user.click(secondCard);

      const band = await findSpotlightBand('세이프원');
      expect(within(band).getByRole('link', { name: '제품 보기' })).toHaveAttribute(
        'href',
        buildBrandProductsHref('brand-two'),
      );
      expect(secondCard).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows a busy placeholder while brands load and keeps the title block when no brand is requested', () => {
      apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
      const { container } = renderDirectory();

      expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeInTheDocument();
      expect(screen.getByText(INTRO_TEXT)).toBeVisible();
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      // 요청된 브랜드가 없으면 밴드 자리를 비워 두지 않습니다.
      expect(container.querySelector('.h-508')).toBeNull();
    });

    it('reserves the spotlight height and hides the title block while a requested brand is loading', () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
      const { container } = renderDirectory();

      expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toHaveClass('sr-only');
      expect(screen.queryByText(INTRO_TEXT)).not.toBeInTheDocument();
      const placeholder = container.querySelector('.h-508');
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('shows the title block again when the requested brand is not in the loaded list', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brd-missing'));
      renderDirectory();

      expect(await screen.findByText(INTRO_TEXT)).toBeVisible();
      expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).not.toHaveClass('sr-only');
      expect(screen.queryByRole('region', { name: '한결&안전' })).not.toBeInTheDocument();
    });

    it('shows the title block when the list fails while a brand is requested', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.listBrands.mockRejectedValue(new ApiError('NETWORK', 'temporary'));
      renderDirectory();

      expect(await screen.findByRole('alert')).toHaveTextContent('브랜드를 불러오지 못했습니다');
      expect(screen.getByText(INTRO_TEXT)).toBeVisible();
    });

    it('shows an empty state and no spotlight when there are no brands', async () => {
      apiMocks.listBrands.mockResolvedValue([]);
      const { container } = renderDirectory();

      expect(
        await screen.findByRole('heading', { name: '등록된 브랜드가 없습니다' }),
      ).toBeVisible();
      expect(
        container.querySelector('section[aria-labelledby="brand-spotlight-title"]'),
      ).toBeNull();
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '제품 보기' })).not.toBeInTheDocument();
      expect(apiMocks.getBrandById).not.toHaveBeenCalled();
      expect(apiMocks.listProducts).not.toHaveBeenCalled();
    });

    it('shows the not-implemented notice without a retry button', async () => {
      apiMocks.listBrands.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.list'));
      renderDirectory();

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
      expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
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
      expect(
        await screen.findByRole('button', { name: '한결&안전, 제품 1개' }),
      ).toBeInTheDocument();
    });

    it('scrolls the band that appears after the first card pick, once the band is mounted', async () => {
      const user = userEvent.setup();
      renderDirectory();

      const secondCard = await screen.findByRole('button', { name: '세이프원, 제품 1개' });
      await user.click(secondCard);

      await findSpotlightBand('세이프원');
      // jsdom은 요소 위치가 0이므로 화면 밖으로 판정되고, 밴드가 마운트된 뒤 effect에서 한 번 옮깁니다.
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'start',
        behavior: 'smooth',
      });
    });
  });

  describe('with a selected brand in the query', () => {
    it('selects the brand named by the brand query and shows its spotlight', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      renderDirectory();

      expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '세이프원, 제품 1개', pressed: true }),
      ).toBeVisible();
    });

    it('shows no spotlight and no pressed card for an unknown brand id, and keeps the list', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brd-missing'));
      renderDirectory();

      expect(await screen.findByRole('button', { name: '한결&안전, 제품 1개' })).toBeVisible();
      expect(screen.queryByRole('region', { name: '한결&안전' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: '세이프원' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
      expect(screen.getByText(INTRO_TEXT)).toBeVisible();
      expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    });

    it('hides the title block and keeps only a screen-reader h1 while a brand is selected', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      renderDirectory();

      await findSpotlightBand('한결&안전');
      const pageHeading = screen.getByRole('heading', { level: 1, name: '브랜드' });
      expect(pageHeading).toHaveClass('sr-only');
      expect(screen.queryByText(INTRO_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByText('브랜드 2개')).not.toBeInTheDocument();
    });

    it('keeps the spotlight CTA as a link to the brand product list when the brand has products', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const cta = within(band).getByRole('link', { name: '제품 보기' });
      expect(cta).toHaveAttribute('href', '/brands/brand-one/products');
      expect(within(band).queryByRole('button', { name: '제품 보기' })).not.toBeInTheDocument();
    });

    it('disables the spotlight CTA without a link when the selected brand has no products', async () => {
      const user = userEvent.setup();
      apiMocks.listBrands.mockResolvedValue([
        brandOne,
        buildBrandSummary('brand-empty', '빈브랜드', { productCount: 0 }),
      ]);
      renderDirectory();

      await user.click(await screen.findByRole('button', { name: '빈브랜드, 제품 0개' }));
      const band = await findSpotlightBand('빈브랜드');

      const disabledCta = within(band).getByRole('button', { name: '제품 보기' });
      expect(disabledCta).toBeDisabled();
      expect(within(band).queryByRole('link', { name: '제품 보기' })).not.toBeInTheDocument();
      expect(disabledCta).toHaveClass('text-text-disabled', 'cursor-not-allowed');
    });

    it('does not scroll on the first load from the query, because the user did not pick the brand', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      renderDirectory();

      await findSpotlightBand('세이프원');
      await waitFor(() => expect(apiMocks.getBrandById).toHaveBeenCalled());

      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('updates the brand query with replace, not a new history entry, when a card is selected', async () => {
      const user = userEvent.setup();
      renderDirectory();

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(navigationMocks.replace).toHaveBeenCalledTimes(1);
      expect(navigationMocks.replace).toHaveBeenCalledWith('/brands?brand=brand-two', {
        scroll: false,
      });
      expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
    });

    it('scrolls the spotlight into view when a card selected from outside the viewport moves it out of sight', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      stubBandRect(band, -985, 508);

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    });

    it('does not scroll when the spotlight is already visible', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      stubBandRect(band, 120, 508);

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls without animation when reduced motion is requested', async () => {
      stubReducedMotion(true);
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      stubBandRect(band, -985, 508);

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    });

    it('does not scroll again when the already selected card is clicked again', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('세이프원');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      stubBandRect(band, -985, 508);

      await user.click(screen.getByRole('button', { name: '세이프원, 제품 1개' }));

      expect(navigationMocks.replace).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls a band that is hidden behind the sticky header (top 40px on mobile)', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      // 밴드 상단이 헤더 높이(모바일 72px) 안쪽에 있어 가려지므로 화면 안이어도 옮깁니다.
      stubBandRect(band, 40, 508);

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    });

    it('uses the desktop header offset on desktop, so a band just under the mobile offset is still scrolled there', async () => {
      stubMediaQueries({ [DESKTOP_QUERY]: true });
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      // 상단 80px는 모바일 기준(72px)이면 보이지만 데스크톱 기준(89px)이면 헤더 뒤입니다.
      stubBandRect(band, 80, 400);

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('does not scroll a band that sits fully below the header on mobile', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      const scrollIntoView = vi.fn();
      band.scrollIntoView = scrollIntoView;
      stubBandRect(band, 80, 400);

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls to the band of the last card picked when two cards are picked quickly, once the URL shows it', async () => {
      // 두 번의 replace가 URL을 바꾸지 않도록 막아 두고(예약만 남김), URL이 마지막 카드로 한 번 바뀌는 상황을 흉내 냅니다.
      navigationMocks.replace.mockImplementationOnce(() => {}).mockImplementationOnce(() => {});
      const user = userEvent.setup();
      renderDirectory();

      await user.click(await screen.findByRole('button', { name: '한결&안전, 제품 1개' }));
      await user.click(screen.getByRole('button', { name: '세이프원, 제품 1개' }));
      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      });

      await findSpotlightBand('세이프원');
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('keeps a reservation for another card while the URL still shows the previous card, then scrolls once when the URL catches up', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      navigationMocks.replace.mockImplementationOnce(() => {});
      const user = userEvent.setup();
      const { queryClient } = renderDirectory();

      await findSpotlightBand('한결&안전');
      await user.click(screen.getByRole('button', { name: '세이프원, 제품 1개' }));

      // URL이 아직 brand-one이므로 예약은 남고 스크롤은 없습니다.
      // 목록을 다시 받아 effect가 한 번 더 돌아도 맞지 않는 예약은 지우지 않아야 합니다.
      apiMocks.listBrands.mockResolvedValue([
        brandOne,
        brandTwo,
        buildBrandSummary('brand-three', '에어가드'),
      ]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.brands.list });
      await screen.findByRole('button', { name: '에어가드, 제품 1개' });
      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      });

      await findSpotlightBand('세이프원');
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('drops a scroll reservation whose brand left the list, so that brand does not scroll when it comes back', async () => {
      navigationMocks.replace.mockImplementationOnce(() => {});
      const user = userEvent.setup();
      const { queryClient } = renderDirectory();

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
      apiMocks.listBrands.mockResolvedValue([brandOne]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.brands.list });
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: '세이프원, 제품 1개' }),
        ).not.toBeInTheDocument(),
      );

      apiMocks.listBrands.mockResolvedValue(brands);
      await queryClient.invalidateQueries({ queryKey: queryKeys.brands.list });
      await screen.findByRole('button', { name: '세이프원, 제품 1개' });
      act(() => {
        navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      });

      await findSpotlightBand('세이프원');
      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('drops an earlier reservation when the last pick is the card already shown, so a later URL change does not scroll', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      navigationMocks.replace.mockImplementationOnce(() => {});
      const user = userEvent.setup();
      renderDirectory();

      await findSpotlightBand('한결&안전');
      await user.click(screen.getByRole('button', { name: '세이프원, 제품 1개' }));
      // 마지막 클릭이 지금 표시된 한결&안전이므로, 앞의 세이프원 예약은 버려집니다.
      await user.click(screen.getByRole('button', { name: '한결&안전, 제품 1개' }));

      act(() => {
        navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      });

      await findSpotlightBand('세이프원');
      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('does not scroll when history returns to a brand that was already selected by the user', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
      await findSpotlightBand('세이프원');
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

      // 뒤로 가기로 다른 브랜드로 돌아갔다가 같은 id(세이프원)로 다시 오면 예약이 남아 있지 않아야 합니다.
      act(() => {
        navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      });
      await findSpotlightBand('한결&안전');
      act(() => {
        navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      });
      await findSpotlightBand('세이프원');

      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('gives the spotlight section the scroll margin for the sticky header, matching the offset constants', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      expect(band).toHaveClass('scroll-mt-72', 'lg:scroll-mt-89');
      expect(SPOTLIGHT_SCROLL_MARGIN_CLASS).toBe(
        `scroll-mt-${SPOTLIGHT_HEADER_OFFSET_PX.mobile} lg:scroll-mt-${SPOTLIGHT_HEADER_OFFSET_PX.desktop}`,
      );
    });

    it('keeps the selected brand when the same card is clicked again', async () => {
      const user = userEvent.setup();
      renderDirectory();

      const secondCard = await screen.findByRole('button', { name: '세이프원, 제품 1개' });
      await user.click(secondCard);
      await findSpotlightBand('세이프원');
      await user.click(secondCard);

      expect(secondCard).toHaveAttribute('aria-pressed', 'true');
      expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    });

    it('marks only one card as pressed and shows selection with the border and weight, not color alone', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      const user = userEvent.setup();
      renderDirectory();

      const firstCard = await screen.findByRole('button', { name: '한결&안전, 제품 1개' });
      const secondCard = screen.getByRole('button', { name: '세이프원, 제품 1개' });
      expect(firstCard).toHaveClass('border-text-1');
      expect(secondCard).toHaveClass('border-line', 'hover:border-text-accent-black');

      await user.click(secondCard);
      await findSpotlightBand('세이프원');

      expect(screen.getAllByRole('button', { pressed: true })).toEqual([secondCard]);
      expect(secondCard).toHaveClass('border-text-1');
      // 로고 플레이스홀더에도 같은 이름이 있으므로 이름 줄(font-bold)을 직접 찾습니다.
      expect(secondCard.querySelector('.font-bold')).toHaveTextContent('세이프원');
      expect(firstCard.querySelector('.font-bold')).toBeNull();
      expect(firstCard).toHaveClass('border-line');
    });

    it('paints the band with the brand accent color', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.listBrands.mockResolvedValue([
        brandOne,
        buildBrandSummary('brand-two', '세이프원', { accentColor: '#466B9A' }),
      ]);
      const user = userEvent.setup();
      renderDirectory();

      const firstBand = await findSpotlightBand('한결&안전');
      expect(firstBand).toHaveStyle({ backgroundColor: DEFAULT_ACCENT_COLOR });

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
      expect(await findSpotlightBand('세이프원')).toHaveStyle({ backgroundColor: '#466B9A' });
    });

    it('falls back to the default color when the accent color is missing or malformed', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.listBrands.mockResolvedValue([
        buildBrandSummary('brand-one', '한결&안전', { accentColor: 'red' }),
        buildBrandSummary('brand-two', '세이프원', { accentColor: '#12345' }),
      ]);
      const user = userEvent.setup();
      renderDirectory();

      expect(await findSpotlightBand('한결&안전')).toHaveStyle({
        backgroundColor: DEFAULT_ACCENT_COLOR,
      });

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
      expect(await findSpotlightBand('세이프원')).toHaveStyle({
        backgroundColor: DEFAULT_ACCENT_COLOR,
      });
    });

    it('uses black text and a black CTA on a light accent, and white text on a dark accent', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.listBrands.mockResolvedValue([
        buildBrandSummary('brand-one', '한결&안전', { accentColor: '#F2F2F2' }),
        buildBrandSummary('brand-two', '세이프원', { accentColor: '#2F6F62' }),
      ]);
      const user = userEvent.setup();
      renderDirectory();

      const lightBand = await findSpotlightBand('한결&안전');
      expect(lightBand).toHaveClass('text-text-accent-black');
      expect(lightBand).not.toHaveClass('text-inverse');
      expect(within(lightBand).getByRole('link', { name: '제품 보기' })).toHaveClass(
        'bg-text-accent-black',
        'text-inverse',
      );

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
      const darkBand = await findSpotlightBand('세이프원');
      expect(darkBand).toHaveClass('text-inverse');
      expect(within(darkBand).getByRole('link', { name: '제품 보기' })).toHaveClass(
        'bg-inverse',
        'text-text-1',
      );
    });

    it('shows no photo and no light placeholder in the hero when the brand has no logo, even when the detail has a cover', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.getBrandById.mockResolvedValueOnce(
        buildBrandDetail(brandOne, { coverImageUrl: 'https://example.com/brand-one-cover.jpg' }),
      );
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      await waitFor(() =>
        expect(within(band).getByText('안전장비', { exact: false })).toBeVisible(),
      );
      // 로고가 없으면 사진 열을 비웁니다. 플레이스홀더(role=img, bg-surface)와 사진 모두 없어야 합니다.
      expect(within(band).queryByRole('img')).not.toBeInTheDocument();
      expect(band.querySelector('img')).toBeNull();
      expect(band.querySelector('.bg-surface')).toBeNull();
    });

    it('collapses the logo column and the mobile text minimum height when the brand has no logo', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      // 로고 열(h-220)과 텍스트 열의 모바일 최소 높이(min-h-220)가 없어야 제목이 위로 올라옵니다.
      // 데스크톱 열 자리는 lg:flex로 남겨 두므로 모바일에서만 hidden입니다.
      expect(band.querySelector('.h-220')).toBeNull();
      expect(band.querySelector('.min-h-220')).toBeNull();
      expect(band.querySelector('.hidden')).not.toBeNull();
      const titleBox = within(band).getByRole('heading', { level: 2, name: '한결&안전' });
      expect(titleBox).toBeVisible();
    });

    it('shows the hero logo image with its brand name when the brand has a logo URL', async () => {
      const logoUrl = 'https://example.com/brand-one-logo.png';
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.listBrands.mockResolvedValue([{ ...brandOne, logoUrl }, brandTwo]);
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      expect(within(band).getByRole('img', { name: '한결&안전 로고' })).toHaveAttribute(
        'src',
        logoUrl,
      );
      // 로고가 있는 밴드는 기존 높이 규칙(모바일 로고 열 h-220, 텍스트 열 min-h-220)을 그대로 씁니다.
      expect(band.querySelector('.h-220')).not.toBeNull();
      expect(band.querySelector('.min-h-220')).not.toBeNull();
    });

    it('keeps the list text and shows no alert when the detail request fails', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      apiMocks.getBrandById.mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'));
      renderDirectory();

      const band = await findSpotlightBand('한결&안전');
      await waitFor(() => expect(band.querySelector('[aria-busy="true"]')).toBeNull());

      expect(within(band).getByRole('heading', { level: 2, name: '한결&안전' })).toBeVisible();
      expect(within(band).getByText('한결&안전 EN')).toBeVisible();
      expect(within(band).getByRole('link', { name: '제품 보기' })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('clears the spotlight and restores the title block when the refetched list no longer has the selected brand', async () => {
      navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
      apiMocks.listBrands.mockResolvedValueOnce(brands).mockResolvedValue([brandOne]);
      const { queryClient } = renderDirectory();

      await findSpotlightBand('세이프원');

      await queryClient.invalidateQueries({ queryKey: queryKeys.brands.list });

      await waitFor(() =>
        expect(screen.queryByRole('region', { name: '세이프원' })).not.toBeInTheDocument(),
      );
      expect(screen.getByText(INTRO_TEXT)).toBeVisible();
      expect(screen.getByRole('button', { name: '한결&안전, 제품 1개' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('ignores a late detail response for a brand that is no longer selected', async () => {
      // 첫 브랜드(brand-one) 상세 응답을 테스트가 직접 늦게 풉니다.
      // 다른 카드로 옮기면 React Query가 그 조회를 취소하므로, 응답이 와도 화면에는 반영되면 안 됩니다.
      navigationMocks.setQuery(new URLSearchParams('brand=brand-one'));
      let resolveBrandOneDetail: (detail: Brand) => void = () => {};
      let isBrandOneDetailSettled = false;
      apiMocks.getBrandById.mockImplementation((brandId: string) => {
        if (brandId === 'brand-one') {
          const lateBrandOneDetail = new Promise<Brand>((resolve) => {
            resolveBrandOneDetail = resolve;
          });
          void lateBrandOneDetail.then(() => {
            isBrandOneDetailSettled = true;
          });
          return lateBrandOneDetail;
        }
        return Promise.resolve(buildBrandDetail(brandTwo, { mainField: '물류안전' }));
      });
      const user = userEvent.setup();
      renderDirectory();

      await findSpotlightBand('한결&안전');
      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
      const band = await findSpotlightBand('세이프원');
      await waitFor(() => expect(within(band).getByText(/물류안전/)).toBeVisible());

      resolveBrandOneDetail(buildBrandDetail(brandOne, { mainField: '늦은응답분야' }));
      await waitFor(() => expect(isBrandOneDetailSettled).toBe(true));

      expect(within(band).getByRole('heading', { level: 2, name: '세이프원' })).toBeVisible();
      expect(within(band).getByText(/물류안전/)).toBeVisible();
      expect(within(band).queryByText(/늦은응답분야/)).not.toBeInTheDocument();
    });
  });

  describe('tile arrow link to the brand product list', () => {
    it('lets the brand name use up to two lines across the card width, with the arrow on the count line', async () => {
      renderDirectory();
      const card = await screen.findByRole('button', { name: '세이프원, 제품 1개' });

      expect(card.querySelector('.line-clamp-2')).toHaveTextContent('세이프원');
      expect(card.querySelector('.truncate')).toBeNull();
      expect(screen.getByRole('link', { name: '세이프원 제품 보기' })).toHaveClass('bottom-14');
    });

    it('links the arrow to the brand product list by brand id as a sibling of the tile button, not inside it', async () => {
      renderDirectory();
      const card = await screen.findByRole('button', { name: '한결&안전, 제품 1개' });
      const arrowLink = screen.getByRole('link', { name: '한결&안전 제품 보기' });

      expect(arrowLink).toHaveAttribute('href', buildBrandProductsHref('brand-one'));
      expect(arrowLink).toHaveAttribute('href', '/brands/brand-one/products');
      expect(arrowLink.closest('button')).toBeNull();
      expect(card.contains(arrowLink)).toBe(false);
      expect(arrowLink.parentElement).toBe(card.parentElement);
    });

    it('moves Tab from the tile body to its arrow link and then to the next tile', async () => {
      const user = userEvent.setup();
      renderDirectory();
      // 그리드 순서는 목록 순서(한결&안전 → 세이프원)이므로, 한결&안전 타일 다음 타일은 세이프원입니다.
      const card = await screen.findByRole('button', { name: '한결&안전, 제품 1개' });
      const arrowLink = screen.getByRole('link', { name: '한결&안전 제품 보기' });

      card.focus();
      await user.tab();
      expect(arrowLink).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: '세이프원, 제품 1개' })).toHaveFocus();
    });

    it('keeps the tile body click selecting the brand in the URL instead of navigating', async () => {
      const user = userEvent.setup();
      renderDirectory();

      await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

      expect(navigationMocks.replace).toHaveBeenCalledWith('/brands?brand=brand-two', {
        scroll: false,
      });
      expect(screen.getByRole('button', { name: '세이프원, 제품 1개' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});
