import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminHomeContentInput, AdminProduct, AdminShopEvent } from '@eum/api/types';
import { AdminHomePage } from './AdminHomePage';
import { AdminEventsPage } from './AdminEventsPage';

const mocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: mocks.getShopApi }));

const product = {
  id: 'prd-test',
  name: '안전모',
  brand: '한결안전',
  categoryId: 'cat-safety',
  price: 10000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
  modelName: null,
  images: [],
  options: [],
  specifications: [],
  certifications: [],
  shipping: { method: '', estimate: '', fee: 0, countryOfOrigin: '', policy: '' },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-01-01',
  isFeatured: false,
} satisfies AdminProduct;

function renderAdmin(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Link to="/events/event-b">다른 이벤트로 바로 이동</Link>
        <Routes>
          <Route path="/home-content" element={<AdminHomePage />} />
          <Route path="/events" element={<AdminEventsPage />} />
          <Route path="/events/new" element={<AdminEventsPage />} />
          <Route path="/events/:eventId" element={<AdminEventsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('홈 편성 및 이벤트 운영', () => {
  let home: AdminHomeContentInput;
  let events: AdminShopEvent[];
  const saveAdminContent = vi.fn(async (input: AdminHomeContentInput) => {
    home = structuredClone(input);
    return home;
  });
  const saveEvent = vi.fn(async (input: Omit<AdminShopEvent, 'id'> & { id?: string }) => {
    const saved = { ...input, id: input.id ?? 'event-created' };
    events = [saved];
    return saved;
  });

  beforeEach(() => {
    home = {
      heroSlides: [
        {
          id: 'hero-1',
          eyebrow: 'HERO',
          title: ['안전'],
          description: '설명',
          tagline: [],
          imageUrl: '/hero.webp',
          destination: '/',
          ctaLabel: '보기',
        },
      ],
      promoBanners: [],
      serviceBenefits: [],
      featuredProductIds: [],
      ctaBand: null,
    };
    events = [];
    mocks.getShopApi.mockResolvedValue({
      home: { getAdminContent: vi.fn(async () => structuredClone(home)), saveAdminContent },
      products: { adminList: vi.fn(async () => [product]) },
      events: {
        adminList: vi.fn(async () => structuredClone(events)),
        saveAdmin: saveEvent,
        deleteAdmin: vi.fn(),
      },
    });
    saveAdminContent.mockClear();
    saveEvent.mockClear();
  });

  it('홈 배너와 추천 상품 편성을 저장한다', async () => {
    const user = userEvent.setup();
    renderAdmin('/home-content');
    await user.clear(await screen.findByLabelText('상단 문구'));
    await user.type(screen.getByLabelText('상단 문구'), 'NEW HERO');
    await user.click(screen.getByRole('checkbox', { name: /안전모/ }));
    await user.click(screen.getAllByRole('button', { name: '변경 사항 저장' })[0]!);
    await waitFor(() =>
      expect(saveAdminContent).toHaveBeenCalledWith(
        expect.objectContaining({
          featuredProductIds: ['prd-test'],
          heroSlides: [expect.objectContaining({ eyebrow: 'NEW HERO' })],
        }),
      ),
    );
  });

  it('프로모션 카드마다 순서 변경 버튼을 한 세트만 표시한다', async () => {
    home.promoBanners = [
      {
        id: 'promo-1',
        title: ['첫 카드'],
        description: '',
        imageUrl: '',
        tone: 'dark',
        destination: '/',
      },
    ];
    renderAdmin('/home-content');

    const promoCard = await screen.findByRole('group', { name: '프로모션 1' });
    expect(within(promoCard).getAllByRole('button', { name: '위로' })).toHaveLength(1);
    expect(within(promoCard).getAllByRole('button', { name: '아래로' })).toHaveLength(1);
  });

  it('홈 편성 구간 바로가기를 각 편집 섹션에 연결한다', async () => {
    renderAdmin('/home-content');
    const navigation = await screen.findByRole('navigation', { name: '홈 편성 섹션 바로가기' });
    for (const [sectionId, label] of [
      ['home-hero', '히어로 슬라이드'],
      ['home-promotions', '프로모션 카드'],
      ['home-benefits', '배송·서비스 혜택'],
      ['home-products', '추천 상품'],
      ['home-cta', '맞춤 주문 CTA'],
    ] as const) {
      expect(within(navigation).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        `#${sectionId}`,
      );
      expect(document.getElementById(sectionId)).toBeInTheDocument();
    }
  });

  it('기간과 상세 콘텐츠가 있는 이벤트를 등록한다', async () => {
    const user = userEvent.setup();
    renderAdmin('/events/new');
    await user.type(await screen.findByRole('textbox', { name: /이벤트명/ }), '11월 안전 이벤트');
    fireEvent.change(screen.getByLabelText('시작일 *'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('종료일 *'), { target: { value: '2026-11-30' } });
    await user.type(screen.getByLabelText('상세 본문'), '운영 상세 내용');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '11월 안전 이벤트',
          body: '운영 상세 내용',
          isVisible: true,
        }),
      ),
    );
  });

  it('이벤트 A 입력 후 이벤트 B로 직접 이동하면 B의 값만 저장한다', async () => {
    const user = userEvent.setup();
    events = [
      {
        id: 'event-a',
        title: '이벤트 A',
        subtitle: '',
        status: 'ongoing',
        startAt: '2026-11-01T00:00:00+09:00',
        endAt: '2026-11-10T23:59:59+09:00',
        eyebrow: '',
        heroTitle: ['A 제목'],
        heroDescription: '',
        body: 'A 본문',
        sections: [],
        searchKeyword: '',
        isVisible: true,
        sortOrder: 0,
      },
      {
        id: 'event-b',
        title: '이벤트 B',
        subtitle: '',
        status: 'upcoming',
        startAt: '2026-12-01T00:00:00+09:00',
        endAt: '2026-12-10T23:59:59+09:00',
        eyebrow: '',
        heroTitle: ['B 제목'],
        heroDescription: '',
        body: 'B 본문',
        sections: [],
        searchKeyword: '',
        isVisible: true,
        sortOrder: 1,
      },
    ];
    renderAdmin('/events/event-a');

    await user.clear(await screen.findByRole('textbox', { name: /이벤트명/ }));
    await user.type(screen.getByRole('textbox', { name: /이벤트명/ }), 'A 임시 입력');
    await user.click(screen.getByRole('link', { name: '다른 이벤트로 바로 이동' }));

    expect(await screen.findByRole('textbox', { name: /이벤트명/ })).toHaveValue('이벤트 B');
    expect(screen.getByLabelText('상세 본문')).toHaveValue('B 본문');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'event-b',
          title: '이벤트 B',
          body: 'B 본문',
        }),
      ),
    );
  });
});
