import { queryKeys } from '@eum/api/query-keys';
import type { Member } from '@eum/api/types';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
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
      <button
        type="button"
        onClick={() =>
          queryClient.setQueryData(queryKeys.coupons.byMember(firstMember.id), ['첫 회원 쿠폰'])
        }
      >
        첫 회원 쿠폰 캐시 설정
      </button>
      <button
        type="button"
        onClick={() =>
          queryClient.setQueryData(queryKeys.coupons.byMember(secondMember.id), ['다른 회원 쿠폰'])
        }
      >
        다른 회원 쿠폰 캐시 설정
      </button>
    </div>
  );
}

function ActiveMemberQuery() {
  const { member, status } = useMemberSession();
  const memberId = member?.id;
  const query = useQuery({
    queryKey: queryKeys.myPage.byMember(memberId ?? 'anonymous'),
    enabled: status === 'ready' && Boolean(memberId),
    queryFn: async () => {
      if (!memberId) throw new Error('회원 세션이 없습니다.');
      return { memberId };
    },
  });
  return (
    <output>{query.data?.memberId ?? (query.isPending ? '마이페이지 질의 중' : '대기')}</output>
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
    fireEvent.click(screen.getByRole('button', { name: '첫 회원 쿠폰 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '다른 회원 쿠폰 캐시 설정' }));
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
      expect(queryClient.getQueryData(queryKeys.coupons.byMember(firstMember.id))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.coupons.byMember(secondMember.id))).toBeUndefined();
    });
  });

  it('switching member removes the previous member inquiry cache', async () => {
    const queryClient = renderSession(
      <>
        <SessionProbe />
        <ActiveMemberQuery />
      </>,
    );
    await screen.findByText('첫 회원');
    await screen.findByText(firstMember.id);
    expect(queryClient.getQueryData(queryKeys.myPage.byMember(firstMember.id))).toEqual({
      memberId: firstMember.id,
    });
    fireEvent.click(screen.getByRole('button', { name: '문의 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주문 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '주소 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '첫 회원 쿠폰 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '다른 회원 쿠폰 캐시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '회원 전환' }));

    await screen.findByText('다른 회원');
    await screen.findByText(secondMember.id);
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
      expect(queryClient.getQueryData(queryKeys.coupons.byMember(firstMember.id))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.coupons.byMember(secondMember.id))).toEqual([
        '다른 회원 쿠폰',
      ]);
      expect(queryClient.getQueryData(queryKeys.myPage.byMember(secondMember.id))).toEqual({
        memberId: secondMember.id,
      });
    });
  });

  it('keeps the active mypage query after a delayed initial session restore', async () => {
    let resolveCurrentUser: ((currentMember: Member | null) => void) | undefined;
    const delayedCurrentUser = new Promise<Member | null>((resolve) => {
      resolveCurrentUser = resolve;
    });
    vi.mocked(getMemberAuth).mockResolvedValue({
      getCurrentUser: vi.fn(() => delayedCurrentUser),
      logout: vi.fn(async () => undefined),
    } as never);
    const queryClient = renderSession(
      <>
        <SessionProbe />
        <ActiveMemberQuery />
      </>,
    );

    expect(screen.getByText('마이페이지 질의 중')).toBeInTheDocument();
    resolveCurrentUser?.(firstMember);

    await screen.findByText(firstMember.id);
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.myPage.byMember(firstMember.id))).toEqual({
        memberId: firstMember.id,
      }),
    );
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
    fireEvent.click(screen.getByRole('button', { name: '첫 회원 쿠폰 캐시 설정' }));

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
      expect(queryClient.getQueryData(queryKeys.coupons.byMember(firstMember.id))).toBeUndefined();
      expect(routerMock.push).toHaveBeenCalledWith('/login');
    });
    await waitFor(() =>
      expect(screen.getByText('로그아웃', { selector: 'p' })).toBeInTheDocument(),
    );
  });
});
