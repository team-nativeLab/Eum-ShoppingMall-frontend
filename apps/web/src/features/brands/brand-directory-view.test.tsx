import { ApiError } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { Brand, BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
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

  it('keeps the spotlight CTA as a link to the brand product list when the brand has products', async () => {
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    const cta = within(band).getByRole('link', { name: '제품 보기' });
    expect(cta).toHaveAttribute('href', '/search?brand=%ED%95%9C%EA%B2%B0%26%EC%95%88%EC%A0%84');
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selects the brand named by the brand query and falls back to the first brand for an unknown id', async () => {
    navigationMocks.setQuery(new URLSearchParams('brand=brand-two'));
    const { unmount } = renderDirectory();

    expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '세이프원, 제품 1개', pressed: true })).toBeVisible();
    unmount();

    navigationMocks.setQuery(new URLSearchParams('brand=brd-missing'));
    renderDirectory();

    expect(await findSpotlightBand('한결&안전')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '한결&안전, 제품 1개', pressed: true }),
    ).toBeVisible();
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
    const user = userEvent.setup();
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    const scrollIntoView = vi.fn();
    band.scrollIntoView = scrollIntoView;
    stubBandRect(band, -985, 508);

    await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('shows a busy placeholder while brands load', () => {
    apiMocks.listBrands.mockReturnValue(new Promise<never>(() => {}));
    const { container } = renderDirectory();

    expect(screen.getByRole('heading', { level: 1, name: '브랜드' })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('shows an empty state and no spotlight when there are no visible brands', async () => {
    apiMocks.listBrands.mockResolvedValue([]);
    const { container } = renderDirectory();

    expect(await screen.findByRole('heading', { name: '등록된 브랜드가 없습니다' })).toBeVisible();
    // 밴드 section은 제목 id(aria-labelledby)로만 식별되므로 그 section 자체가 없는지 확인합니다.
    expect(container.querySelector('section[aria-labelledby="brand-spotlight-title"]')).toBeNull();
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '제품 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '제품 보기' })).not.toBeInTheDocument();
    expect(apiMocks.getBrandById).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();
  });

  it('selects a brand card from the keyboard with Tab to focus and Enter to select', async () => {
    const user = userEvent.setup();
    renderDirectory();

    const secondCard = await screen.findByRole('button', { name: '세이프원, 제품 1개' });
    // 탭 순서에는 밴드 CTA와 앞 카드가 끼어 있으므로, 카드에 닿을 때까지 Tab을 누릅니다.
    for (let step = 0; step < 10 && document.activeElement !== secondCard; step += 1) {
      await user.tab();
    }
    expect(secondCard).toHaveFocus();
    expect(secondCard).toHaveAttribute('aria-pressed', 'false');

    await user.keyboard('{Enter}');

    expect(secondCard).toHaveAttribute('aria-pressed', 'true');
    expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
  });

  it('selects the first brand by default and links the spotlight CTA to its product list', async () => {
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    expect(
      screen.getByRole('button', { name: '한결&안전, 제품 1개', pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '세이프원, 제품 1개', pressed: false }),
    ).toBeVisible();
    expect(within(band).getByRole('link', { name: '제품 보기' })).toHaveAttribute(
      'href',
      '/search?brand=%ED%95%9C%EA%B2%B0%26%EC%95%88%EC%A0%84',
    );
    await waitFor(() =>
      expect(apiMocks.getBrandById).toHaveBeenCalledWith('brand-one', expect.anything()),
    );
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
      '/search?brand=%EC%84%B8%EC%9D%B4%ED%94%84%EC%9B%90',
    );
    expect(secondCard).toHaveAttribute('aria-pressed', 'true');
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

  it('shows the logo plate centered and leaves the photo column empty when the brand has no cover', async () => {
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    // 상세 조회가 끝나야 플레이트가 그려집니다. 그 전에는 skeleton만 있습니다.
    expect(await within(band).findByRole('img', { name: '한결&안전 로고' })).toBeInTheDocument();
    expect(band.querySelector('img')).toBeNull();
    expect(band.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the cover photo with the logo plate on top when the detail has a cover', async () => {
    const coverUrl = 'https://example.com/brand-one-cover.jpg';
    apiMocks.getBrandById.mockResolvedValueOnce(
      buildBrandDetail(brandOne, { coverImageUrl: coverUrl }),
    );
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    await waitFor(() => expect(band.querySelector(`img[src="${coverUrl}"]`)).toBeInTheDocument());
    expect(within(band).getByRole('img', { name: '한결&안전 로고' })).toBeInTheDocument();
  });

  it('falls back to the logo plate alone when the cover photo fails to load', async () => {
    const coverUrl = 'https://example.com/broken-cover.jpg';
    apiMocks.getBrandById.mockResolvedValueOnce(
      buildBrandDetail(brandOne, { coverImageUrl: coverUrl }),
    );
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    await waitFor(() => expect(band.querySelector(`img[src="${coverUrl}"]`)).toBeInTheDocument());
    const coverImage = band.querySelector(`img[src="${coverUrl}"]`);
    if (!(coverImage instanceof HTMLImageElement)) {
      throw new Error('사진 요소를 찾지 못했습니다.');
    }

    fireEvent.error(coverImage);

    await waitFor(() => expect(band.querySelector('img')).toBeNull());
    expect(within(band).getByRole('img', { name: '한결&안전 로고' })).toBeInTheDocument();
  });

  it('keeps the list text and shows no alert when the detail request fails', async () => {
    apiMocks.getBrandById.mockRejectedValueOnce(new ApiError('NETWORK', 'temporary'));
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    await waitFor(() => expect(band.querySelector('[aria-busy="true"]')).toBeNull());

    expect(within(band).getByRole('heading', { level: 2, name: '한결&안전' })).toBeVisible();
    expect(within(band).getByText('한결&안전 EN')).toBeVisible();
    expect(within(band).getByRole('link', { name: '제품 보기' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces a selected brand with the first brand when the refetched list no longer has it', async () => {
    apiMocks.listBrands.mockResolvedValueOnce(brands).mockResolvedValue([brandOne]);
    const user = userEvent.setup();
    const { queryClient } = renderDirectory();

    await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
    await findSpotlightBand('세이프원');

    await queryClient.invalidateQueries({ queryKey: queryKeys.brands.list });

    expect(await findSpotlightBand('한결&안전')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '세이프원, 제품 1개' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '한결&안전, 제품 1개', pressed: true }),
    ).toBeVisible();
  });

  it('ignores a late detail response for a brand that is no longer selected', async () => {
    // 첫 브랜드(brand-one) 상세 응답을 테스트가 직접 늦게 풉니다.
    // 다른 카드로 옮기면 React Query가 그 조회를 취소하므로, 응답이 와도 화면에는 반영되면 안 됩니다.
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
      return Promise.resolve(
        buildBrandDetail(brandTwo, {
          coverImageUrl: 'https://example.com/brand-two-cover.jpg',
        }),
      );
    });
    const user = userEvent.setup();
    renderDirectory();

    await findSpotlightBand('한결&안전');
    await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
    const band = await findSpotlightBand('세이프원');
    await waitFor(() =>
      expect(band.querySelector('img[src$="brand-two-cover.jpg"]')).toBeInTheDocument(),
    );

    resolveBrandOneDetail(
      buildBrandDetail(brandOne, { coverImageUrl: 'https://example.com/brand-one-cover.jpg' }),
    );
    await waitFor(() => expect(isBrandOneDetailSettled).toBe(true));

    expect(within(band).getByRole('heading', { level: 2, name: '세이프원' })).toBeVisible();
    expect(band.querySelector('img[src$="brand-two-cover.jpg"]')).toBeInTheDocument();
    expect(band.querySelector('img[src$="brand-one-cover.jpg"]')).toBeNull();
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
    expect(await screen.findByRole('button', { name: '한결&안전, 제품 1개' })).toBeInTheDocument();
  });

  it('shows the not-implemented notice without a retry button', async () => {
    apiMocks.listBrands.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'brands.list'));
    renderDirectory();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('브랜드 조회 기능을 준비하고 있습니다');
    expect(within(errorAlert).queryByRole('button')).not.toBeInTheDocument();
  });
});
