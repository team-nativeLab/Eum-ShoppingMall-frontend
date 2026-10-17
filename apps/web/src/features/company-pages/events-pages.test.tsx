import type { ShopApi } from '@eum/api/shop-api';
import type { ShopEvent } from '@eum/api/types';
import { ApiError } from '@eum/api/errors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopApi } from '@/lib/shop-api';
import { EventDetailPage, EventsPage } from './events-pages';

const apiMocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const event: ShopEvent = {
  id: 'event-a',
  title: '안전 캠페인',
  subtitle: '현장 안전을 위한 상품을 만나보세요.',
  status: 'ongoing',
  startAt: '2026-10-01T00:00:00+09:00',
  endAt: '2026-10-31T23:59:59+09:00',
  eyebrow: 'SAFETY EVENT',
  heroTitle: ['안전한 현장을', '함께 만듭니다'],
  heroDescription: '캠페인 안내입니다.',
  body: '이벤트 본문',
  sections: [{ heading: '참여 안내', body: '상품을 확인해 주세요.' }],
  searchKeyword: '안전',
};

function renderPage(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.list.mockResolvedValue([event]);
  apiMocks.detail.mockResolvedValue(event);
  vi.mocked(getShopApi).mockResolvedValue({
    events: { list: apiMocks.list, getById: apiMocks.detail },
  } as unknown as ShopApi);
});

describe('이벤트 화면', () => {
  it('목록 카드에서 직접 상세 경로로 이동할 수 있습니다', async () => {
    renderPage(<EventsPage />);
    expect(await screen.findByRole('link', { name: /안전 캠페인/ })).toHaveAttribute(
      'href',
      '/events/event-a',
    );
    expect(screen.getByRole('button', { name: '진행중' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('목록 오류와 빈 상태를 각각 표시합니다', async () => {
    apiMocks.list.mockResolvedValue([]);
    renderPage(<EventsPage />);
    expect(await screen.findByText('등록된 이벤트가 없습니다')).toBeInTheDocument();
  });

  it('상세 응답이 없는 ID를 not-found로 처리합니다', async () => {
    apiMocks.detail.mockRejectedValue(new ApiError('NOT_FOUND', 'missing'));
    renderPage(<EventDetailPage eventId="missing" />);
    expect(await screen.findByText('요청하신 이벤트를 찾을 수 없습니다.')).toBeInTheDocument();
  });
});
