import type { Category, HomeContent, Product } from '@eum/api/types';
import type { ShopApi } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopApi } from '@/lib/shop-api';
import { SiteMenuProvider } from '@/components/site-menu-context';
import type * as ProductCarouselModule from './product-carousel';
import { HomeView } from './home-view';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  carouselLayout: {
    pageSize: 8,
    columns: 4,
    rows: 2,
    cardWidth: 158,
    minCardHeight: 292,
    gap: 16,
  },
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
vi.mock('@/lib/use-media-query', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('./product-carousel', async (importOriginal) => {
  const original = await importOriginal<typeof ProductCarouselModule>();
  return {
    ...original,
    ProductCarouselTrack: ({
      label,
      pageIndex,
      desktopLayout,
    }: {
      label: string;
      pageIndex: number;
      desktopLayout?: { pageSize: number; minCardHeight: number };
    }) => (
      <ul
        aria-label={label}
        data-page-index={pageIndex}
        data-page-size={desktopLayout?.pageSize}
        data-card-min-height={desktopLayout?.minCardHeight}
      />
    ),
    useHomeCarouselLayout: () => ({ ...apiMocks.carouselLayout }),
  };
});

const homeContent: HomeContent = {
  heroSlides: [
    {
      id: 'hero-test',
      eyebrow: 'SAFE TOMORROW',
      title: ['안전한 현장'],
      description: '테스트 배너입니다.',
      tagline: [],
      imageUrl: '',
      destination: '/about',
      ctaLabel: '둘러보기',
      secondaryCta: { label: '회사소개 보기', destination: '/about' },
    },
  ],
  promoBanners: [
    {
      id: 'promo-one',
      title: ['첫 번째 안내'],
      description: '짧은 안내입니다.',
      imageUrl: '',
      tone: 'dark',
      destination: '/about',
    },
    {
      id: 'promo-two',
      title: ['두 번째 안내'],
      description:
        '현장의 상황과 작업 환경에 맞는 안전 솔루션을 제안하며, 필요한 제품과 맞춤 서비스를 함께 안내합니다.\n안전맛집이 현장별 선택을 돕습니다.',
      imageUrl: '',
      tone: 'light',
      destination: '/about',
    },
    {
      id: 'promo-three',
      title: ['세 번째 안내'],
      description: '프로모션 안내입니다.',
      imageUrl: '',
      tone: 'dark',
      destination: '/about',
    },
  ],
  serviceBenefits: [{ id: 'benefit-one', title: '무료배송', description: '테스트 안내입니다.' }],
  featuredProducts: [
    {
      id: 'featured-test',
      name: '테스트 상품',
      brand: '테스트 브랜드',
      categoryId: 'test-category',
      price: 1000,
      listPrice: null,
      priceVisible: true,
      stockStatus: 'inStock',
      thumbnailUrl: null,
      summary: '테스트 상품입니다.',
      modelName: null,
      images: [],
      options: [],
      specifications: [],
      certifications: [],
      shipping: {
        method: 'standard',
        estimate: '3일 이내 출고',
        fee: 0,
        countryOfOrigin: '대한민국',
        policy: '',
      },
      purchaseNotices: [],
      rating: null,
      reviewCount: 0,
      createdAt: '2026-10-15T00:00:00.000Z',
      isFeatured: true,
    } satisfies Product,
  ],
  ctaBand: {
    eyebrow: 'CUSTOM ORDER',
    title: '현장 견적 상담',
    cta: { label: '문의하기', destination: '/solutions' },
  },
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <SiteMenuProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SiteMenuProvider>
    );
  };
}

function createApi(homeResponse = homeContent, categories: Category[] = []): ShopApi {
  return {
    home: { getContent: async () => homeResponse },
    categories: { list: async () => categories },
    popups: { list: async () => [] },
    products: { list: async () => ({ items: [], page: 1, pageSize: 10, totalCount: 0 }) },
  } as unknown as ShopApi;
}

function followsInDocument(previousElement: Element, nextElement: Element) {
  return Boolean(
    previousElement.compareDocumentPosition(nextElement) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

beforeEach(() => {
  vi.mocked(getShopApi).mockResolvedValue(createApi());
});

describe('HomeView section layout and responsive promo copy spacing', () => {
  it.each([
    [1024, 8],
    [1279, 8],
    [1280, 10],
  ])('matches the %i px carousel layout in the pending discount skeleton', async (width, count) => {
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.assign(apiMocks.carouselLayout, {
      pageSize: count,
      columns: count === 8 ? 4 : 5,
      rows: 2,
      cardWidth: 220,
      minCardHeight: 284,
      gap: 16,
    });
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi(),
      products: { list: () => new Promise(() => undefined) },
    } as unknown as ShopApi);

    try {
      render(<HomeView />, { wrapper: createWrapper() });
      const skeleton = await screen.findByTestId('home-discount-skeleton');

      expect(skeleton.children).toHaveLength(count);
      expect(skeleton).toHaveClass(
        'grid-flow-col',
        'lg:auto-cols-[var(--home-carousel-card-width)]',
        'lg:gap-x-[var(--home-carousel-gap)]',
      );
      expect(skeleton.style.getPropertyValue('--home-carousel-card-width')).toContain(
        'min(1336px, 100vw)',
      );
      expect(skeleton).toHaveStyle({
        '--home-carousel-card-min-height': '284px',
        '--home-carousel-gap': '16px',
      });
      expect(skeleton.firstElementChild).toHaveClass(
        'lg:min-h-[var(--home-carousel-card-min-height)]',
      );
    } finally {
      Object.assign(apiMocks.carouselLayout, {
        pageSize: 8,
        columns: 4,
        rows: 2,
        cardWidth: 158,
        minCardHeight: 292,
        gap: 16,
      });
      if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth);
      else Reflect.deleteProperty(window, 'innerWidth');
    }
  });

  it('keeps the 390 px discount skeleton in a two-column, two-row mobile layout without horizontal overflow', async () => {
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.assign(apiMocks.carouselLayout, {
      pageSize: 4,
      columns: 2,
      rows: 2,
      cardWidth: 220,
      minCardHeight: 284,
      gap: 16,
    });
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi(),
      products: { list: () => new Promise(() => undefined) },
    } as unknown as ShopApi);

    try {
      render(<HomeView />, { wrapper: createWrapper() });
      const skeleton = await screen.findByTestId('home-discount-skeleton');

      expect(skeleton.children).toHaveLength(4);
      expect(skeleton).toHaveClass(
        'grid-flow-col',
        'grid-rows-2',
        'auto-cols-[calc((100%-12px)/2)]',
      );
      expect(skeleton).not.toHaveClass('grid-rows-1');
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    } finally {
      Object.assign(apiMocks.carouselLayout, {
        pageSize: 8,
        columns: 4,
        rows: 2,
        cardWidth: 158,
        minCardHeight: 292,
        gap: 16,
      });
      if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth);
      else Reflect.deleteProperty(window, 'innerWidth');
    }
  });

  it('does not duplicate the category launcher in the hero and adds a discount carousel', async () => {
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi(),
      products: {
        list: async () => ({
          items: homeContent.featuredProducts,
          page: 1,
          pageSize: 10,
          totalCount: 1,
        }),
      },
    } as unknown as ShopApi);

    render(<HomeView />, { wrapper: createWrapper() });

    expect(screen.queryByRole('button', { name: '카테고리 메뉴 열기' })).toBeNull();
    const activeHeroSlide = await screen.findByRole('group', { name: '1개 중 1번째 배너' });
    expect(activeHeroSlide.parentElement).toHaveClass('lg:ml-64');

    expect(await screen.findByRole('heading', { name: '할인 상품' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '할인 상품 전체 보기' })).toHaveAttribute(
      'href',
      '/discounts',
    );
  });

  it('preserves section order, desktop promo geometry, and responsive promo copy spacing', async () => {
    render(<HomeView />, { wrapper: createWrapper() });

    const heroSection = await screen.findByRole('region', { name: '주요 프로모션' });
    const promoSection = await screen.findByRole('region', { name: '안전 솔루션 프로모션' });
    const bestSellerSection = screen.getByRole('region', { name: '베스트' });
    const quoteSection = screen.getByRole('region', { name: '현장 견적 상담' });
    const serviceBenefits = screen.getByRole('list', { name: '서비스 안내' });

    expect(followsInDocument(heroSection, promoSection)).toBe(true);
    expect(followsInDocument(promoSection, bestSellerSection)).toBe(true);
    expect(followsInDocument(bestSellerSection, quoteSection)).toBe(true);
    expect(followsInDocument(quoteSection, serviceBenefits)).toBe(true);

    expect(promoSection).toHaveClass('lg:mt-24');
    expect(promoSection.firstElementChild).toHaveClass('lg:grid-cols-3', 'lg:gap-16');
    const promoCards = within(promoSection).getAllByRole('link');
    expect(promoCards).toHaveLength(3);
    expect(promoCards[0]).toHaveClass('h-216', 'lg:h-auto', 'lg:min-h-204');
    for (const [index, promoCard] of promoCards.entries()) {
      expect(promoCard).toHaveAttribute('href', '/about');
      expect(promoCard.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
      const promoCta = promoCard.querySelector('span[aria-hidden="true"]');
      const copyCtaGroup = promoCta?.parentElement;
      const description = promoCard.querySelector('p');
      expect(description?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        homeContent.promoBanners[index]?.description.replace(/\s+/g, ' ').trim(),
      );
      expect(copyCtaGroup).toHaveClass('mt-auto', 'flex', 'flex-col', 'gap-11', 'lg:gap-7');
      expect(copyCtaGroup?.firstElementChild).toBe(description);
      expect(copyCtaGroup?.lastElementChild).toBe(promoCta);
      expect(promoCta).not.toBeNull();
      expect(promoCta).toHaveClass('size-32', 'shrink-0', 'rounded-capsule');
      expect(promoCta?.querySelector('svg')).toHaveAttribute('width', '16');
      expect(promoCard).toHaveClass('focus-ring');
    }
    expect(promoCards[0]?.querySelector('span[aria-hidden="true"]')).toHaveClass('text-inverse');
    expect(promoCards[1]?.querySelector('span[aria-hidden="true"]')).toHaveClass('text-text-1');
    expect(bestSellerSection.parentElement).toHaveClass('lg:mt-64');
    const productTrack = screen.getByRole('list', { name: '베스트 상품' });
    const productRow = productTrack.parentElement;
    expect(productRow).toHaveClass('mt-16', 'lg:mt-24');
    expect(productTrack).toHaveAttribute('data-page-size', '8');
    expect(productTrack).toHaveAttribute('data-card-min-height', '292');
    expect(quoteSection).toHaveClass('mt-64');
    expect(serviceBenefits).toHaveClass('mt-64');
  });

  it('keeps the promo card keyboard-focusable as one link with a decorative CTA', async () => {
    const user = userEvent.setup();
    render(<HomeView />, { wrapper: createWrapper() });

    const promoSection = await screen.findByRole('region', { name: '안전 솔루션 프로모션' });
    const promoCard = within(promoSection).getAllByRole('link')[0];
    if (!promoCard) throw new Error('Expected a promo card link.');

    let tabCount = 0;
    while (document.activeElement !== promoCard && tabCount < 100) {
      await user.tab();
      tabCount += 1;
    }

    expect(promoCard).toHaveFocus();
    expect(promoCard).toHaveAttribute('href', '/about');
    expect(promoCard.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
    expect(promoCard.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('keeps the hero company link destination and label without a plus icon', async () => {
    render(<HomeView />, { wrapper: createWrapper() });

    const companyLink = await screen.findByRole('link', { name: '회사소개 보기' });

    expect(companyLink).toHaveAttribute('href', '/about');
    expect(companyLink.querySelector('svg')).toBeNull();
    expect(companyLink).toHaveClass('hidden', 'lg:inline-flex');
    expect(screen.getByRole('link', { name: '둘러보기' })).toHaveAttribute('href', '/about');
  });

  it('pages the best seller carousel without category chips', async () => {
    const firstProduct = homeContent.featuredProducts[0];
    if (!firstProduct) throw new Error('Expected one home product fixture.');
    const featuredProducts = Array.from({ length: 13 }, (_, index) => ({
      ...firstProduct,
      id: `featured-${index}`,
      categoryId: 'safety',
    }));
    vi.mocked(getShopApi).mockResolvedValue(createApi({ ...homeContent, featuredProducts }));

    render(<HomeView />, { wrapper: createWrapper() });

    const track = await screen.findByRole('list', { name: '베스트 상품' });
    expect(track).toHaveAttribute('data-page-size', '8');
    expect(track).toHaveAttribute('data-page-index', '0');

    fireEvent.click(await screen.findByRole('button', { name: '다음 베스트 상품' }));
    await waitFor(() => expect(track).toHaveAttribute('data-page-index', '1'));
    expect(screen.getByText('2페이지 중 2페이지')).toBeInTheDocument();
  });

  it('does not render category chips or a 전체 tab in the best seller section', async () => {
    const categories: Category[] = [
      {
        id: 'safety',
        slug: 'safety',
        name: '안전용품',
        parentId: null,
        description: null,
        iconKey: null,
      },
    ];
    vi.mocked(getShopApi).mockResolvedValue(createApi(homeContent, categories));

    render(<HomeView />, { wrapper: createWrapper() });

    const bestSellerSection = await screen.findByRole('region', { name: '베스트' });
    expect(
      within(bestSellerSection).queryByRole('group', { name: '베스트 상품 카테고리' }),
    ).toBeNull();
    expect(within(bestSellerSection).queryByRole('button', { name: '전체' })).toBeNull();
    expect(within(bestSellerSection).queryByRole('button', { name: '안전용품' })).toBeNull();
  });

  it('does not add a 전체보기 tile to the home category bar', async () => {
    const categories: Category[] = [
      {
        id: 'safety',
        slug: 'safety',
        name: '안전용품',
        parentId: null,
        description: null,
        iconKey: null,
      },
    ];
    vi.mocked(getShopApi).mockResolvedValue(createApi(homeContent, categories));

    render(<HomeView />, { wrapper: createWrapper() });

    await screen.findByRole('region', { name: '베스트' });
    const categoryNavigations = await screen.findAllByRole('navigation', { name: '상품 카테고리' });
    expect(categoryNavigations).toHaveLength(2);
    for (const categoryNavigation of categoryNavigations) {
      expect(within(categoryNavigation).queryByRole('link', { name: '전체보기' })).toBeNull();
    }
  });

  it('shows the empty best seller message when no best products are registered', async () => {
    vi.mocked(getShopApi).mockResolvedValue(createApi({ ...homeContent, featuredProducts: [] }));

    render(<HomeView />, { wrapper: createWrapper() });

    const bestSellerSection = await screen.findByRole('region', { name: '베스트' });
    expect(
      within(bestSellerSection).getByText('등록된 베스트 상품이 없습니다.'),
    ).toBeInTheDocument();
    expect(within(bestSellerSection).queryByRole('list', { name: '베스트 상품' })).toBeNull();
  });
});

describe('HomeView best and recommended view-all links', () => {
  it('sends best seller links to /best and recommended links to /recommended', async () => {
    const sampleProduct = homeContent.featuredProducts[0];
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi(),
      products: {
        list: async () => ({ items: [sampleProduct], page: 1, pageSize: 7, totalCount: 1 }),
        listRecommended: async () => [sampleProduct],
      },
    } as unknown as ShopApi);

    render(<HomeView />, { wrapper: createWrapper() });

    const bestSellerSection = await screen.findByRole('region', { name: '베스트' });
    const recommendedSection = await screen.findByRole('region', { name: '추천상품' });

    expect(within(bestSellerSection).getByRole('link', { name: '전체 보기' })).toHaveAttribute(
      'href',
      '/best',
    );
    expect(
      within(bestSellerSection).getByRole('link', { name: '베스트 전체 보기' }),
    ).toHaveAttribute('href', '/best');
    expect(within(recommendedSection).getByRole('link', { name: '전체 보기' })).toHaveAttribute(
      'href',
      '/recommended',
    );
    expect(
      within(recommendedSection).getByRole('link', { name: '추천상품 전체 보기' }),
    ).toHaveAttribute('href', '/recommended');
  });
});
