import { ApiError } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { Brand, BrandSummary } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBrandProductsHref } from '@/features/products/product-navigation';
import { DESKTOP_QUERY, REDUCED_MOTION_QUERY } from '@/lib/use-media-query';
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

/** 인덱스 키 제목(h3)으로 섹션 요소를 찾습니다. */
async function findSectionByKey(indexKeyLabel: string) {
  const sectionHeading = await screen.findByRole('heading', { level: 3, name: indexKeyLabel });
  const section = sectionHeading.closest('section');
  if (!(section instanceof HTMLElement)) {
    throw new Error('섹션을 찾지 못했습니다.');
  }
  return section;
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
    // 키 행은 가로 스크롤만 옮기므로 scrollBy를 씁니다. jsdom에 없을 수 있어 항상 스텁합니다.
    Element.prototype.scrollBy = vi.fn();
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
    // 탭 순서에는 밴드 CTA, 검색창, 인덱스 키와 앞 카드가 끼어 있으므로, 카드에 닿을 때까지 Tab을 누릅니다.
    for (let step = 0; step < 20 && document.activeElement !== secondCard; step += 1) {
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

  it('shows no photo and no light placeholder in the hero when the brand has no logo, even when the detail has a cover', async () => {
    apiMocks.getBrandById.mockResolvedValueOnce(
      buildBrandDetail(brandOne, { coverImageUrl: 'https://example.com/brand-one-cover.jpg' }),
    );
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    await waitFor(() => expect(within(band).getByText('안전장비', { exact: false })).toBeVisible());
    // 로고가 없으면 사진 열을 비웁니다. 플레이스홀더(role=img, bg-surface)와 사진 모두 없어야 합니다.
    expect(within(band).queryByRole('img')).not.toBeInTheDocument();
    expect(band.querySelector('img')).toBeNull();
    expect(band.querySelector('.bg-surface')).toBeNull();
  });

  it('shows the hero logo image with its brand name when the brand has a logo URL', async () => {
    const logoUrl = 'https://example.com/brand-one-logo.png';
    apiMocks.listBrands.mockResolvedValue([{ ...brandOne, logoUrl }, brandTwo]);
    renderDirectory();

    const band = await findSpotlightBand('한결&안전');
    expect(within(band).getByRole('img', { name: '한결&안전 로고' })).toHaveAttribute(
      'src',
      logoUrl,
    );
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

  it('disables index keys with no brand in the current results and marks 전체 as the active key', async () => {
    renderDirectory();
    await findSpotlightBand('한결&안전');

    expect(screen.getByRole('button', { name: 'ㅅ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ㅎ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ㄱ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '#' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
    // 키 버튼은 선택 상태를 aria-pressed로 알리지 않습니다(카드 버튼만 aria-pressed를 씁니다).
    expect(screen.getByRole('button', { name: 'ㅅ' })).not.toHaveAttribute('aria-pressed');
  });

  it('groups brands into a section per key with a heading, a count, and the brand card inside', async () => {
    renderDirectory();

    const section = await findSectionByKey('ㅅ');
    expect(section).toHaveAttribute('id', 'brand-section-ㅅ');
    expect(section.getAttribute('aria-labelledby')).toBe('brand-section-ㅅ-heading');
    expect(within(section).getByText('1개')).toBeVisible();
    expect(within(section).getByRole('button', { name: '세이프원, 제품 1개' })).toBeInTheDocument();
  });

  describe('tile arrow link to the brand product list', () => {
    it('links the arrow to the brand product list as a sibling of the tile button, not inside it', async () => {
      renderDirectory();
      const card = await screen.findByRole('button', { name: '한결&안전, 제품 1개' });
      const arrowLink = screen.getByRole('link', { name: '한결&안전 제품 보기' });

      expect(arrowLink).toHaveAttribute('href', buildBrandProductsHref('한결&안전'));
      expect(arrowLink.closest('button')).toBeNull();
      expect(card.contains(arrowLink)).toBe(false);
      expect(arrowLink.parentElement).toBe(card.parentElement);
    });

    it('moves Tab from the tile body to its arrow link and then to the next tile', async () => {
      const user = userEvent.setup();
      renderDirectory();
      // 섹션 순서는 ㅅ(세이프원) → ㅎ(한결&안전)이므로, 세이프원 타일 다음 타일은 한결&안전입니다.
      const card = await screen.findByRole('button', { name: '세이프원, 제품 1개' });
      const arrowLink = screen.getByRole('link', { name: '세이프원 제품 보기' });

      card.focus();
      await user.tab();
      expect(arrowLink).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: '한결&안전, 제품 1개' })).toHaveFocus();
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

  it('scrolls the index key row, once, below the sticky header when an index key is pressed', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');

    const keyRow = screen.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' });
    const scrollIntoView = vi.fn();
    keyRow.scrollIntoView = scrollIntoView;

    await user.click(screen.getByRole('button', { name: 'ㅅ' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    // 키 행은 가로 스크롤만 옮기므로, 키 버튼 자체의 scrollIntoView(문서 세로 이동)는 일어나지 않아야 합니다.
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'ㅅ' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: '전체' })).not.toHaveAttribute('aria-current');
  });

  it('moves focus to the section heading after 전체보기 is pressed', async () => {
    const user = userEvent.setup();
    apiMocks.listBrands.mockResolvedValue([
      ...Array.from({ length: 5 }, (_, index) =>
        buildBrandSummary(`brand-g${index}`, `가${index}브랜드`),
      ),
      brandTwo,
    ]);
    renderDirectory();
    const section = await findSectionByKey('ㄱ');

    await user.click(within(section).getByRole('button', { name: 'ㄱ 브랜드 전체보기' }));

    expect(document.getElementById('brand-section-ㄱ-heading')).toHaveFocus();
  });

  it('shows 12 brands per section before 전체보기 on desktop and 4 on mobile', async () => {
    const fourteenGiyeokBrands = Array.from({ length: 14 }, (_, index) =>
      buildBrandSummary(`brand-g${index}`, `가${index}브랜드`),
    );
    apiMocks.listBrands.mockResolvedValue(fourteenGiyeokBrands);
    stubMediaQueries({ [DESKTOP_QUERY]: true });
    const { unmount } = renderDirectory();

    const desktopSection = await findSectionByKey('ㄱ');
    expect(within(desktopSection).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(12);
    expect(
      within(desktopSection).getByRole('button', { name: 'ㄱ 브랜드 전체보기' }),
    ).toBeVisible();
    unmount();

    stubMediaQueries({});
    renderDirectory();
    const mobileSection = await findSectionByKey('ㄱ');
    expect(within(mobileSection).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(4);
  });

  it('scrolls the index key row, not the result list, when an index key is pressed during search', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');
    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), 'en');
    const keyRow = screen.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' });
    const scrollIntoView = vi.fn();
    keyRow.scrollIntoView = scrollIntoView;

    await user.click(screen.getByRole('button', { name: 'ㅅ' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(
      within(screen.getByRole('list', { name: '검색 결과 브랜드' })).getAllByRole('button', {
        name: /제품 \d+개$/,
      }),
    ).toHaveLength(1);
  });

  it('announces the number of search results in a polite live region', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');

    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), 'en');

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('브랜드 2개 검색됨');
  });

  it('scrolls the index key row without animation when reduced motion is requested', async () => {
    stubReducedMotion(true);
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');

    const keyRow = screen.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' });
    const scrollIntoView = vi.fn();
    keyRow.scrollIntoView = scrollIntoView;

    await user.click(screen.getByRole('button', { name: 'ㅅ' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('shows the search empty state and hides the sections when nothing matches, keeping the total count', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');

    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '없는브랜드');

    expect(
      await screen.findByRole('heading', { level: 3, name: '검색 결과가 없습니다' }),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { level: 3, name: 'ㅅ' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '등록된 브랜드가 없습니다' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('브랜드 2개')).toBeVisible();
  });

  it('keeps the selected brand band and the URL while a search hides the selected card', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.click(await screen.findByRole('button', { name: '세이프원, 제품 1개' }));
    await findSpotlightBand('세이프원');
    navigationMocks.replace.mockClear();

    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '한결');

    expect(screen.queryByRole('button', { name: '세이프원, 제품 1개' })).not.toBeInTheDocument();
    expect(await findSpotlightBand('세이프원')).toBeInTheDocument();
    expect(navigationMocks.replace).not.toHaveBeenCalled();
    expect(navigationMocks.getQuery().get('brand')).toBe('brand-two');
  });

  it('resets the chosen key to 전체 when a search starts, and keeps 전체 after the search is cleared', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');
    await user.click(await screen.findByRole('button', { name: 'ㅅ' }));
    expect(screen.getByRole('button', { name: 'ㅅ' })).toHaveAttribute('aria-current', 'true');

    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '한결');
    expect(screen.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'ㅅ' })).not.toHaveAttribute('aria-current');
  });

  it('shows matched brands as one flat list without section headings while searching, matching name and English name', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await findSpotlightBand('한결&안전');

    // 세이프원은 이름이 아니라 영문명(세이프원 EN)으로만 일치합니다.
    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '세이프원 en');
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체보기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: '검색 결과 브랜드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '세이프원, 제품 1개' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '한결&안전, 제품 1개' })).not.toBeInTheDocument();
  });

  it('lists every matched brand during search without the two-row preview limit', async () => {
    const manyBrands = Array.from({ length: 6 }, (_, index) =>
      buildBrandSummary(`brand-g${index}`, `가${index}브랜드`),
    );
    apiMocks.listBrands.mockResolvedValue([...manyBrands, brandTwo]);
    const user = userEvent.setup();
    renderDirectory();
    await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });

    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '브랜드');

    const resultList = screen.getByRole('list', { name: '검색 결과 브랜드' });
    expect(within(resultList).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /브랜드 전체보기/ })).not.toBeInTheDocument();
  });

  it('shows the section groups again when the search is cleared', async () => {
    const manyBrands = Array.from({ length: 5 }, (_, index) =>
      buildBrandSummary(`brand-g${index}`, `가${index}브랜드`),
    );
    apiMocks.listBrands.mockResolvedValue(manyBrands);
    const user = userEvent.setup();
    renderDirectory();
    await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });

    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '가1');
    expect(screen.queryByRole('heading', { level: 3, name: 'ㄱ' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'ㄱ' })).toBeVisible();
    expect(screen.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ㄱ 브랜드 전체보기' })).toBeInTheDocument();
  });

  describe('search mode keeps the index keys and filters the flat result list', () => {
    const giyeokBrands = Array.from({ length: 5 }, (_, index) =>
      buildBrandSummary(`brand-g${index}`, `가${index}브랜드`),
    );

    beforeEach(() => {
      // 모든 브랜드의 영문명은 "<이름> EN"이라 검색어 'en'이 전부를 맞춥니다.
      apiMocks.listBrands.mockResolvedValue([...giyeokBrands, brandOne, brandTwo]);
    });

    it('keeps the index key row visible during search and disables keys with no matching brand', async () => {
      const user = userEvent.setup();
      renderDirectory();
      await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });

      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '한결');

      expect(screen.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ㅎ' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'ㅅ' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'ㄱ' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
    });

    it('lists all matched brands in one flat list with no section headings, while 전체 is current', async () => {
      const user = userEvent.setup();
      renderDirectory();
      await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });

      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), 'en');

      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
      const resultList = screen.getByRole('list', { name: '검색 결과 브랜드' });
      expect(within(resultList).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(7);
      expect(screen.queryByRole('button', { name: /브랜드 전체보기/ })).not.toBeInTheDocument();
    });

    it('shows only the matched brands of the pressed key, as the intersection with the search', async () => {
      const user = userEvent.setup();
      renderDirectory();
      await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });
      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), 'en');

      await user.click(screen.getByRole('button', { name: 'ㅅ' }));

      expect(screen.getByRole('button', { name: 'ㅅ' })).toHaveAttribute('aria-current', 'true');
      const resultList = screen.getByRole('list', { name: '검색 결과 브랜드' });
      expect(within(resultList).getAllByRole('button', { name: /제품 \d+개$/ })).toEqual([
        screen.getByRole('button', { name: '세이프원, 제품 1개' }),
      ]);
      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    });

    it('resets the pressed key to 전체 when the search keyword changes', async () => {
      const user = userEvent.setup();
      renderDirectory();
      await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });
      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), 'en');
      await user.click(screen.getByRole('button', { name: 'ㅅ' }));

      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), ' ');

      expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
      const resultList = screen.getByRole('list', { name: '검색 결과 브랜드' });
      expect(within(resultList).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(7);
    });

    it('returns to the section groups when the search is cleared', async () => {
      const user = userEvent.setup();
      renderDirectory();
      await screen.findByRole('button', { name: '가0브랜드, 제품 1개' });
      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), 'en');

      await user.click(screen.getByRole('button', { name: '검색어 지우기' }));

      expect(await screen.findByRole('heading', { level: 3, name: 'ㄱ' })).toBeVisible();
      expect(screen.getByRole('heading', { level: 3, name: 'ㅅ' })).toBeVisible();
      expect(screen.queryByRole('list', { name: '검색 결과 브랜드' })).not.toBeInTheDocument();
    });
  });

  describe('two-row preview per section', () => {
    // 기본 matchMedia 스텁은 모든 질의에 false를 돌려주므로 모바일 2열(한 섹션 최대 4개)로 동작합니다.
    const fiveGiyeokBrands = Array.from({ length: 5 }, (_, index) =>
      buildBrandSummary(`brand-g${index}`, `가${index}브랜드`),
    );

    beforeEach(() => {
      apiMocks.listBrands.mockResolvedValue([...fiveGiyeokBrands, brandTwo]);
    });

    it('limits each section to two rows and shows 전체보기 only for sections with more brands', async () => {
      renderDirectory();

      const section = await findSectionByKey('ㄱ');
      expect(within(section).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(4);
      expect(within(section).getByRole('button', { name: 'ㄱ 브랜드 전체보기' })).toBeVisible();
      expect(within(section).getByText('5개')).toBeVisible();

      const otherSection = await findSectionByKey('ㅅ');
      expect(
        within(otherSection).queryByRole('button', { name: /전체보기/ }),
      ).not.toBeInTheDocument();
    });

    it('shows every brand of the section after 전체보기 and makes that key the only current one', async () => {
      const user = userEvent.setup();
      renderDirectory();
      const section = await findSectionByKey('ㄱ');

      await user.click(within(section).getByRole('button', { name: 'ㄱ 브랜드 전체보기' }));

      expect(screen.getByRole('button', { name: 'ㄱ' })).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', { name: '전체' })).not.toHaveAttribute('aria-current');
      const expanded = await findSectionByKey('ㄱ');
      expect(within(expanded).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(5);
      expect(within(expanded).queryByRole('button', { name: /전체보기/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 3, name: 'ㅅ' })).not.toBeInTheDocument();
    });

    it('shows every brand of the section when its index key is pressed', async () => {
      const user = userEvent.setup();
      renderDirectory();
      await findSectionByKey('ㄱ');

      await user.click(screen.getByRole('button', { name: 'ㄱ' }));

      const expanded = await findSectionByKey('ㄱ');
      expect(within(expanded).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(5);
      expect(screen.queryByRole('heading', { level: 3, name: 'ㅅ' })).not.toBeInTheDocument();
    });

    it('returns to the two-row preview when 전체 is pressed', async () => {
      const user = userEvent.setup();
      renderDirectory();
      const section = await findSectionByKey('ㄱ');
      await user.click(within(section).getByRole('button', { name: 'ㄱ 브랜드 전체보기' }));

      await user.click(screen.getByRole('button', { name: '전체' }));

      expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
      const preview = await findSectionByKey('ㄱ');
      expect(within(preview).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(4);
      expect(await findSectionByKey('ㅅ')).toBeInTheDocument();
    });

    it('returns to the two-row preview after a search is started and cleared', async () => {
      const user = userEvent.setup();
      renderDirectory();
      const section = await findSectionByKey('ㄱ');
      await user.click(within(section).getByRole('button', { name: 'ㄱ 브랜드 전체보기' }));

      await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '가1');
      await user.click(screen.getByRole('button', { name: '검색어 지우기' }));

      expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
      const preview = await findSectionByKey('ㄱ');
      expect(within(preview).getAllByRole('button', { name: /제품 \d+개$/ })).toHaveLength(4);
    });
  });

  it('returns to 전체 when a refetched list no longer has the chosen key', async () => {
    apiMocks.listBrands.mockResolvedValueOnce(brands).mockResolvedValue([brandOne]);
    const user = userEvent.setup();
    const { queryClient } = renderDirectory();
    await findSpotlightBand('한결&안전');
    await user.click(await screen.findByRole('button', { name: 'ㅅ' }));

    await queryClient.invalidateQueries({ queryKey: queryKeys.brands.list });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '세이프원, 제품 1개' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'ㅅ' })).toBeDisabled();
  });
});
