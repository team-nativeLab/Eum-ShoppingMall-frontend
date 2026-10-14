import { queryKeys } from '@eum/api/query-keys';
import type { Member } from '@eum/api/types';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemberAuth } from '@/lib/member-auth';
import { MemberSessionProvider, useMemberSession } from './member-session';
import { MyPageShell } from '@/features/mypage/mypage-shell';

vi.mock('@/lib/member-auth', () => ({ getMemberAuth: vi.fn() }));
const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerMock.push }) }));

const firstMember: Member = {
  id: 'mem-001',
  email: 'first@example.com',
  name: '첫 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

const secondMember: Member = { ...firstMember, id: 'mem-002', name: '다른 회원' };

function SessionProbe() {
  const { member, clearMember, setMember } = useMemberSession();
  const queryClient = useQueryClient();
  return (
    <div>
      <p>{member?.name ?? '로그아웃'}</p>
      <button type="button" onClick={() => void clearMember()}>
        로그아웃
      </button>
      <button type="button" onClick={() => setMember(secondMember)}>
        회원 전환
      </button>
      <button
        type="button"
        onClick={() =>
          queryClient.setQueryData(queryKeys.inquiries.byMember(firstMember.id), ['문의 본문'])
        }
      >
        문의 캐시 설정
      </button>
      <button
        type="button"
        onClick={() =>
          queryClient.setQueryData(queryKeys.orders.byMember(firstMember.id), ['주문'])
        }
      >
        주문 캐시 설정
      </button>
      <button
        type="button"
        onClick={() => {
          queryClient.setQueryData(queryKeys.addresses.byMember(firstMember.id), ['주소']);
          queryClient.setQueryData(
            [...queryKeys.myPage.byMember(firstMember.id), 'addresses', []],
            ['회원 배송지'],
          );
        }}
      >
        주소 캐시 설정
      </button>
    </div>
  );
}

function renderSession(children: ReactNode) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>{children}</MemberSessionProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.mocked(getMemberAuth).mockResolvedValue({
    getCurrentUser: vi.fn(async () => firstMember),
    logout: vi.fn(async () => undefined),
  } as never);
});

describe('member inquiry cache privacy', () => {
  it('logout removes the current member inquiry cache', async () => {
    const queryClient = renderSession(<SessionProbe />);
    await screen.findByText('첫 회원');
    fireEvent.click(screen.getByRole('button', { name: '문의 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주문 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주소 캐시 설정' }));
    expect(queryClient.getQueryData(queryKeys.inquiries.byMember(firstMember.id))).toEqual([
      '문의 본문',
    ]);
    expect(queryClient.getQueryData(queryKeys.orders.byMember(firstMember.id))).toEqual(['주문']);
    expect(queryClient.getQueryData(queryKeys.addresses.byMember(firstMember.id))).toEqual([
      '주소',
    ]);
    expect(
      queryClient.getQueryData([...queryKeys.myPage.byMember(firstMember.id), 'addresses', []]),
    ).toEqual(['회원 배송지']);

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => {
      expect(
        queryClient.getQueryData(queryKeys.inquiries.byMember(firstMember.id)),
      ).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.orders.byMember(firstMember.id))).toBeUndefined();
      expect(
        queryClient.getQueryData(queryKeys.addresses.byMember(firstMember.id)),
      ).toBeUndefined();
      expect(
        queryClient.getQueryData([...queryKeys.myPage.byMember(firstMember.id), 'addresses', []]),
      ).toBeUndefined();
    });
  });

  it('switching member removes the previous member inquiry cache', async () => {
    const queryClient = renderSession(<SessionProbe />);
    await screen.findByText('첫 회원');
    fireEvent.click(screen.getByRole('button', { name: '문의 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주문 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주소 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '회원 전환' }));

    await screen.findByText('다른 회원');
    await waitFor(() => {
      expect(
        queryClient.getQueryData(queryKeys.inquiries.byMember(firstMember.id)),
      ).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.orders.byMember(firstMember.id))).toBeUndefined();
      expect(
        queryClient.getQueryData(queryKeys.addresses.byMember(firstMember.id)),
      ).toBeUndefined();
      expect(
        queryClient.getQueryData([...queryKeys.myPage.byMember(firstMember.id), 'addresses', []]),
      ).toBeUndefined();
    });
  });

  it('mypage logout clears member caches and navigates to login', async () => {
    const queryClient = renderSession(
      <MyPageShell activeSection="dashboard" title="마이페이지">
        <SessionProbe />
      </MyPageShell>,
    );
    await screen.findByText('첫 회원');
    fireEvent.click(screen.getByRole('button', { name: '문의 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주문 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주소 캐시 설정' }));

    fireEvent.click(
      within(screen.getByRole('complementary', { name: '마이페이지 메뉴' })).getByRole('button', {
        name: '로그아웃',
      }),
    );

    await waitFor(() => {
      expect(
        queryClient.getQueryData(queryKeys.inquiries.byMember(firstMember.id)),
      ).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.orders.byMember(firstMember.id))).toBeUndefined();
      expect(
        queryClient.getQueryData(queryKeys.addresses.byMember(firstMember.id)),
      ).toBeUndefined();
      expect(
        queryClient.getQueryData([...queryKeys.myPage.byMember(firstMember.id), 'addresses', []]),
      ).toBeUndefined();
      expect(routerMock.push).toHaveBeenCalledWith('/login');
    });
    await waitFor(() =>
      expect(screen.getByText('로그아웃', { selector: 'p' })).toBeInTheDocument(),
    );
  });
});
