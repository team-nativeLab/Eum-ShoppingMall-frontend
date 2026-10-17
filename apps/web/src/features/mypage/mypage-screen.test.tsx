import type { Claim, Member } from '@eum/api/types';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyPageData } from './mypage-data';
import type * as MyPageDataModule from './mypage-data';
import { MyPageScreen } from './mypage-screen';

const myPageMocks = vi.hoisted(() => ({ useMyPageData: vi.fn() }));

vi.mock('./mypage-data', async (importOriginal) => {
  const original = await importOriginal<typeof MyPageDataModule>();
  return { ...original, useMyPageData: myPageMocks.useMyPageData };
});
vi.mock('@/features/auth/member-session', () => ({
  useMemberSession: () => ({
    member: {
      id: 'member-a',
      email: 'member@example.com',
      name: '목 회원',
      phone: '',
      joinedAt: '2026-10-01T00:00:00+09:00',
      pointBalance: 0,
    } satisfies Member,
    status: 'ready',
    clearMember: vi.fn(),
    refreshMember: vi.fn(),
  }),
}));
vi.mock('@/features/products/local-collections-context', () => ({
  useLocalCollections: () => ({ wishlistIds: [], recentIds: [], recentViewedAt: {} }),
}));
vi.mock('@/lib/api-config', () => ({ getWebApiConfig: () => ({ mode: 'real' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...linkProps
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...linkProps}>
      {children}
    </a>
  ),
}));

const claim: Claim = {
  id: 'claim-a',
  orderId: 'order-a',
  type: 'exchange',
  status: 'processing',
  reason: '사이즈 교환',
  requestedAt: new Date().toISOString(),
};

const member: Member = {
  id: 'member-a',
  email: 'member@example.com',
  name: '목 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  myPageMocks.useMyPageData.mockReturnValue({
    data: {
      member,
      orders: [],
      claims: [claim],
      coupons: [],
      points: [],
      addresses: [],
      quotes: [],
      products: [],
      unavailableProductIds: [],
      loadWarnings: [],
    } satisfies MyPageData,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe('마이페이지 클레임 목록', () => {
  it('신청 상세 링크의 모바일 조작 높이를 44px 이상 확보합니다', () => {
    render(<MyPageScreen section="claims" />);

    const claimLink = screen.getByRole('link', { name: '신청 상세' });
    expect(claimLink).toHaveAttribute('href', '/mypage/claims/claim-a');
    expect(claimLink).toHaveClass('min-h-44');
  });
});
