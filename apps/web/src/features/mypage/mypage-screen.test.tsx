import type { Claim, Member } from '@eum/api/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('마이페이지 배송지 편집', () => {
  it('uses the shared padded native select for delivery requests', async () => {
    const user = userEvent.setup();
    render(<MyPageScreen section="addresses" />);

    await user.click(screen.getByRole('button', { name: '배송지 추가' }));

    const deliveryNote = screen.getByLabelText('배송 요청사항');
    expect(deliveryNote.tagName).toBe('SELECT');
    expect(deliveryNote).toHaveClass('appearance-none', 'pr-40');
    expect(deliveryNote.parentElement?.querySelector('svg')).toHaveClass('right-14');
    expect(deliveryNote).toHaveValue('');
    expect(screen.getByRole('option', { name: '선택해 주세요' })).toHaveValue('');
    expect(screen.getByRole('option', { name: '배송 전 연락 바랍니다' })).toHaveValue(
      '배송 전 연락 바랍니다',
    );
    expect(screen.getByRole('option', { name: '문 앞에 놓아 주세요' })).toHaveValue(
      '문 앞에 놓아 주세요',
    );

    await user.selectOptions(deliveryNote, '문 앞에 놓아 주세요');
    expect(deliveryNote).toHaveValue('문 앞에 놓아 주세요');
  });
});
