import type { Category, HomeContent, Product } from '@eum/api/types';
import type { ShopApi } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopApi } from '@/lib/shop-api';
import type * as ProductCarouselModule from './product-carousel';
import { HomeView } from './home-view';

const apiMocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));

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
      desktopLayout?: { pageSize: number };
    }) => (
      <ul aria-label={label} data-page-index={pageIndex} data-page-size={desktopLayout?.pageSize} />
    ),
    useHomeCarouselLayout: () => ({
      pageSize: 7,
      cardWidth: 158,
      cardHeight: 368,
      gap: 16,
    }),
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
      description: '프로모션 안내입니다.',
      imageUrl: '',
      tone: 'dark',
      destination: '/about',
    },
    {
      id: 'promo-two',
      title: ['두 번째 안내'],
      description: '프로모션 안내입니다.',
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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createApi(homeResponse = homeContent, categories: Category[] = []): ShopApi {
  return {
    home: { getContent: async () => homeResponse },
    categories: { list: async () => categories },
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

describe('HomeView desktop section layout', () => {
  it('follows the W-01 section order and promo geometry without changing mobile sizing', async () => {
    render(<HomeView />, { wrapper: createWrapper() });

    const heroSection = await screen.findByRole('region', { name: '주요 프로모션' });
    const promoSection = await screen.findByRole('region', { name: '안전 솔루션 프로모션' });
    const bestSellerSection = screen.getByRole('region', { name: '베스트 셀러' });
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
    for (const promoCard of promoCards) {
      expect(promoCard).toHaveAttribute('href', '/about');
      expect(promoCard.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
      const promoCta = promoCard.querySelector('span[aria-hidden="true"]');
      expect(promoCta).not.toBeNull();
      expect(promoCta).toHaveClass(
        'mt-auto',
        'size-36',
        'shrink-0',
        'translate-y-[5px]',
        'rounded-capsule',
      );
      expect(promoCta?.querySelector('svg')).toHaveAttribute('width', '16');
      expect(promoCard).toHaveClass('focus-ring');
    }
    expect(promoCards[0]?.querySelector('span[aria-hidden="true"]')).toHaveClass('text-inverse');
    expect(promoCards[1]?.querySelector('span[aria-hidden="true"]')).toHaveClass('text-text-1');
    expect(bestSellerSection.parentElement).toHaveClass('lg:mt-64');
    const productTrack = screen.getByRole('list', { name: '베스트 상품' });
    const productRow = productTrack.parentElement;
    expect(productRow).toHaveClass('mt-16', 'lg:mt-24');
    expect(productTrack).toHaveAttribute('data-page-size', '7');
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

  it('resets the home carousel to the first page when selecting a category', async () => {
    const firstProduct = homeContent.featuredProducts[0];
    if (!firstProduct) throw new Error('Expected one home product fixture.');
    const featuredProducts = Array.from({ length: 8 }, (_, index) => ({
      ...firstProduct,
      id: `featured-${index}`,
      categoryId: 'safety',
    }));
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
    vi.mocked(getShopApi).mockResolvedValue(
      createApi({ ...homeContent, featuredProducts }, categories),
    );

    render(<HomeView />, { wrapper: createWrapper() });

    const track = await screen.findByRole('list', { name: '베스트 상품' });
    expect(track).toHaveAttribute('data-page-size', '7');
    expect(track).toHaveAttribute('data-page-index', '0');

    fireEvent.click(await screen.findByRole('button', { name: '다음 베스트 상품' }));
    await waitFor(() => expect(track).toHaveAttribute('data-page-index', '1'));
    expect(screen.getByText('2페이지 중 2페이지')).toBeInTheDocument();

    const safetyCategoryButton = screen.getAllByRole('button', { name: '안전용품' })[0];
    if (!safetyCategoryButton) throw new Error('Expected the safety category button.');
    fireEvent.click(safetyCategoryButton);
    await waitFor(() =>
      expect(screen.getByRole('list', { name: '베스트 상품' })).toHaveAttribute(
        'data-page-index',
        '0',
      ),
    );
    expect(screen.queryByText('2페이지 중 1페이지')).not.toBeInTheDocument();
  });
});
