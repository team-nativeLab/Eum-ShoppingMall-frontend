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
  it('clears member-owned caches and navigates to login', async () => {
    const queryClient = renderPage();
    await screen.findByText(member.id);
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
