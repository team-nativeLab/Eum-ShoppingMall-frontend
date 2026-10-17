import type { Notice } from '@eum/api/types';
import { ApiError } from '@eum/api/errors';
import type { ShopApi } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopApi } from '@/lib/shop-api';
import { NoticeDetailPage } from './notice-detail-page';

const apiMocks = vi.hoisted(() => ({ list: vi.fn() }));
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
  body: '배송 일정 안내입니다.\n상품별 정책을 확인해 주세요.',
  bodyImage: { src: null, alt: '공지 본문 이미지' },
  attachments: [{ id: 'attachment-a', fileName: '파일명.pdf', sizeBytes: 0 }],
  isPinned: true,
  publishedAt: '2026-10-01T00:00:00+09:00',
  viewCount: 12,
};
const olderNotice: Notice = {
  ...notice,
  id: 'notice-older',
  title: '이전 공지',
  publishedAt: '2026-09-01T00:00:00+09:00',
};
const newerNotice: Notice = {
  ...notice,
  id: 'notice-newer',
  title: '다음 공지',
  publishedAt: '2026-11-01T00:00:00+09:00',
};

function renderDetail(noticeId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NoticeDetailPage noticeId={noticeId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.list.mockResolvedValue([newerNotice, notice, olderNotice]);
  vi.mocked(getShopApi).mockResolvedValue({
    notices: { list: apiMocks.list },
  } as unknown as ShopApi);
});

describe('공지사항 상세', () => {
  it('공지 본문을 텍스트로 렌더링하고 목록 라우트를 제공합니다', async () => {
    const { container } = renderDetail('notice-a');
    expect(await screen.findByRole('heading', { name: '배송 안내' })).toBeInTheDocument();
    expect(screen.getByText(/상품별 정책을 확인해 주세요/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '공지 본문 이미지' })).toBeInTheDocument();
    expect(screen.getByText('첨부파일 1')).toBeInTheDocument();
    expect(screen.getByText('파일명.pdf')).toBeInTheDocument();
    expect(screen.getByText('0.0MB')).toBeInTheDocument();
    expect(container.querySelector('a[download]')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute(
      'href',
      '/support/notices',
    );
    const noticeNavigation = screen.getByRole('navigation', { name: '이전·다음 공지' });
    expect(
      noticeNavigation.querySelector('time[datetime="2026-09-01T00:00:00+09:00"]'),
    ).toHaveTextContent('2026. 09. 01.');
    expect(
      noticeNavigation.querySelector('time[datetime="2026-11-01T00:00:00+09:00"]'),
    ).toHaveTextContent('2026. 11. 01.');
  });

  it('목록 조회 성공 후 없는 ID는 not-found 상태로 구분합니다', async () => {
    renderDetail('missing');
    expect(
      await screen.findByRole('heading', { name: '요청하신 공지사항을 찾을 수 없습니다.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('공지사항을 불러오지 못했습니다.')).not.toBeInTheDocument();
  });

  it('목록 요청 실패는 not-found 대신 재시도 오류 상태를 표시합니다', async () => {
    apiMocks.list.mockRejectedValue(new Error('network'));
    renderDetail('notice-a');
    expect(await screen.findByText('공지사항을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '요청하신 공지사항을 찾을 수 없습니다.' }),
    ).not.toBeInTheDocument();
  });

  it('real mode의 NOT_IMPLEMENTED는 재시도 없이 준비 중 상태로 표시합니다', async () => {
    apiMocks.list.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'not connected'));
    renderDetail('notice-a');

    expect(await screen.findByText('공지사항 기능을 준비하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('유효하지 않은 인접 공지 날짜는 날짜 행에 표시하지 않습니다', async () => {
    apiMocks.list.mockResolvedValue([
      newerNotice,
      notice,
      { ...olderNotice, publishedAt: 'invalid-date' },
    ]);
    renderDetail('notice-a');

    const noticeNavigation = await screen.findByRole('navigation', { name: '이전·다음 공지' });
    const noticeRows = noticeNavigation.querySelectorAll(':scope > div');
    expect(noticeRows[0]?.querySelector('time')).toBeNull();
    expect(noticeRows[1]?.querySelector('time')).toBeInTheDocument();
    expect(noticeNavigation).toHaveTextContent('이전글');
  });
});
