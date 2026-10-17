import { queryKeys } from '@eum/api/query-keys';
import type { Member } from '@eum/api/types';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemberAuth } from '@/lib/member-auth';
import { MemberSessionProvider, useMemberSession } from '@/features/auth/member-session';
import { MyPageShell } from './mypage-shell';

vi.mock('@/lib/member-auth', () => ({ getMemberAuth: vi.fn() }));
const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerMock.push }) }));

const member: Member = {
  id: 'member-logout-test',
  email: 'member@example.com',
  name: '목 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

function MemberProbe() {
  const { member: currentMember } = useMemberSession();
  const queryClient = useQueryClient();
  return (
    <>
      <p>{currentMember?.id ?? '로그아웃됨'}</p>
      <button
        type="button"
        onClick={() => {
          queryClient.setQueryData(queryKeys.addresses.byMember(member.id), ['주소']);
          queryClient.setQueryData(
            [...queryKeys.myPage.byMember(member.id), 'addresses', []],
            ['마이페이지 주소'],
          );
          queryClient.setQueryData(queryKeys.inquiries.byMember(member.id), ['문의']);
          queryClient.setQueryData(queryKeys.orders.byMember(member.id), ['주문']);
        }}
      >
        회원 캐시 설정
      </button>
    </>
  );
}

function renderPage() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>
        <MyPageShell activeSection="dashboard" title="마이페이지">
          <MemberProbe />
        </MyPageShell>
      </MemberSessionProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  routerMock.push.mockReset();
  vi.mocked(getMemberAuth).mockResolvedValue({
    getCurrentUser: vi.fn(async () => member),
    logout: vi.fn(async () => undefined),
  } as never);
});

describe('MyPageShell logout', () => {
  it('renders a single page heading with its optional description and action', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemberSessionProvider>
          <MyPageShell
            activeSection="claims"
            title="신청 상세"
            titleDescription="신청 정보를 확인합니다."
            titleAction={<span>처리 중</span>}
          >
            <p>신청 내용</p>
          </MyPageShell>
        </MemberSessionProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: '신청 상세' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('신청 정보를 확인합니다.')).toBeInTheDocument();
    expect(screen.getByText('처리 중')).toBeInTheDocument();
    expect(screen.getByText('신청 내용')).toBeInTheDocument();
  });

  it('can hide both navigation menus and render a custom claim breadcrumb trail', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemberSessionProvider>
          <MyPageShell
            activeSection="claims"
            title="신청 상세"
            hideNavigation
            breadcrumbTrail={[
              { label: '취소·반품 내역', href: '/mypage/claims' },
              { label: '신청 상세' },
            ]}
          >
            <p>신청 내용</p>
          </MyPageShell>
        </MemberSessionProvider>
      </QueryClientProvider>,
    );

    const breadcrumb = await screen.findByRole('navigation', { name: '현재 위치' });
    const claimsLink = within(breadcrumb).getByRole('link', { name: '취소·반품 내역' });
    expect(claimsLink).toHaveAttribute('href', '/mypage/claims');
    expect(within(breadcrumb).getByText('신청 상세')).toHaveAttribute('aria-current', 'page');
    expect(breadcrumb.parentElement).toHaveClass('max-w-[1240px]');
    expect(screen.queryByRole('navigation', { name: '모바일 마이페이지 메뉴' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: '마이페이지 메뉴' })).toBeNull();
  });

  it('clears member-owned caches and navigates to login', async () => {
    const queryClient = renderPage();
    await screen.findByText(member.id);
    expect(screen.getByRole('navigation', { name: '모바일 마이페이지 메뉴' })).toBeVisible();
    expect(screen.getByRole('complementary', { name: '마이페이지 메뉴' })).toBeVisible();
    const mypageShell = screen.getByText(member.id).closest('[data-mypage-shell]');
    const desktopLayout = mypageShell?.querySelector(':scope > div > div.grid');
    expect(desktopLayout).toHaveClass('lg:grid-cols-[196px_minmax(0,1fr)]', 'lg:gap-24');
    fireEvent.click(screen.getByRole('button', { name: '회원 캐시 설정' }));

    const mobileMenu = screen.getByRole('navigation', { name: '모바일 마이페이지 메뉴' });
    fireEvent.click(within(mobileMenu).getByRole('button', { name: '로그아웃' }));

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.addresses.byMember(member.id))).toBeUndefined();
      expect(
        queryClient.getQueryData([...queryKeys.myPage.byMember(member.id), 'addresses', []]),
      ).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.inquiries.byMember(member.id))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.orders.byMember(member.id))).toBeUndefined();
      expect(routerMock.push).toHaveBeenCalledWith('/login');
    });
    expect(await screen.findByText('로그아웃됨')).toBeInTheDocument();
  });
});
