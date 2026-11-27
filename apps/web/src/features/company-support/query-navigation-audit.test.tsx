import type { Notice } from '@eum/api/types';
import type { ShopApi } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopApi } from '@/lib/shop-api';
import { NoticesPage } from './support-pages';
import { NoticeDetailPage } from './notice-detail-page';

vi.mock('@/lib/shop-api', () => ({ getShopApi: vi.fn() }));
vi.mock('./support-shell', () => ({
  SupportShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
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

const notice: Notice = {
  id: 'notice-a',
  title: '배송 안내',
  body: '배송 일정 안내입니다.',
  bodyImage: { src: null, alt: '공지 본문 이미지' },
  attachments: [],
  isPinned: false,
  publishedAt: '2026-10-01T00:00:00+09:00',
  viewCount: 12,
};

const apiMocks = vi.hoisted(() => ({ list: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.list.mockResolvedValue([notice]);
  vi.mocked(getShopApi).mockResolvedValue({
    notices: { list: apiMocks.list },
  } as unknown as ShopApi);
});

describe('공지 목록에서 상세로 이동할 때 query cache를 재사용합니다', () => {
  it('30초 freshness 구간에서 notices.list를 다시 호출하지 않습니다', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <NoticesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText('배송 안내')).toHaveLength(2);
    const callsAfterList = apiMocks.list.mock.calls.length;

    rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeDetailPage noticeId="notice-a" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: '배송 안내' })).toBeInTheDocument();
    expect(callsAfterList).toBe(1);
    expect(apiMocks.list).toHaveBeenCalledTimes(callsAfterList);
  });
});
