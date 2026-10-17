import type { Address, Claim, Member, Order } from '@eum/api/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { useLocalCollections } from '@/features/products/local-collections-context';
import { MyPageScreen } from './mypage-screen';
import { useMyPageData, type MyPageData } from './mypage-data';

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerMock.push }) }));
vi.mock('@/features/auth/member-session', () => ({ useMemberSession: vi.fn() }));
vi.mock('@/features/products/local-collections-context', () => ({
  useLocalCollections: vi.fn(),
}));
vi.mock('./mypage-data', () => ({
  formatMyPageDate: (value: string) => value,
  formatMyPagePrice: (value: number) => `${value}원`,
  getCollectionProductIds: () => [],
  useMyPageData: vi.fn(),
}));

const member: Member = {
  id: 'member-claim-form-test',
  email: 'member@example.com',
  name: '목 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

const claim: Claim = {
  id: 'claim-1',
  orderId: 'order-1',
  type: 'exchange',
  status: 'processing',
  reason: '사이즈 교환',
  requestedAt: '2026-10-01T00:00:00+09:00',
};

const address: Address = {
  id: 'address-1',
  label: '기본 배송지',
  recipientName: '목 회원',
  phone: '010-0000-0000',
  postalCode: '00000',
  address1: '서울시',
  address2: '마포구',
  isDefault: true,
};

const order: Order = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  orderedAt: '2026-10-01T00:00:00+09:00',
  status: 'delivered',
  memberId: member.id,
  lines: [{ productId: 'product-1', productName: '안전모', unitPrice: 12000, quantity: 2 }],
  productTotal: 24000,
  shippingFee: 0,
  discountTotal: 0,
  pointUsed: 0,
  paymentTotal: 24000,
  shippingAddress: address,
};

const myPageData: MyPageData = {
  member,
  orders: [order],
  claims: [claim],
  coupons: [],
  points: [],
  addresses: [address],
  quotes: [],
  products: [],
  unavailableProductIds: [],
  loadWarnings: [],
};

function renderMyPageSection(section: 'claim-new' | 'claims' | 'points' | 'addresses') {
  vi.mocked(useMyPageData).mockReturnValue({
    data: myPageData,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  return render(<MyPageScreen section={section} />);
}

function renderClaimApplication() {
  return renderMyPageSection('claim-new');
}

function getReasonCard(reason: string) {
  const reasonGroup = screen.getByRole('radiogroup', { name: '사유' });
  const radio = within(reasonGroup).getByRole('radio', { name: reason });
  const card = radio.closest('label');
  if (!card) throw new Error(`사유 카드 라벨을 찾지 못했습니다: ${reason}`);
  return { radio, card };
}

beforeEach(() => {
  routerMock.push.mockReset();
  vi.mocked(useMemberSession).mockReturnValue({
    member,
    status: 'ready',
    refreshMember: async () => member,
    setMember: vi.fn(),
    clearMember: async () => undefined,
  });
  vi.mocked(useLocalCollections).mockReturnValue({
    wishlistIds: [],
    recentIds: [],
    recentViewedAt: {},
    toggleWishlist: vi.fn(),
    recordRecent: vi.fn(),
    removeRecent: vi.fn(),
    clearRecent: vi.fn(),
  });
});

describe('MyPageScreen claim application', () => {
  it('keeps native claim selects keyboard accessible and spaces custom chevrons from the edge', () => {
    renderClaimApplication();

    for (const label of ['주문 선택', '회수 주소 선택']) {
      const select = screen.getByRole('combobox', { name: label });
      expect(select.tagName).toBe('SELECT');
      expect(select).toHaveClass('appearance-none', 'pr-40', 'focus-ring');

      const wrapper = select.parentElement;
      if (!wrapper) throw new Error(`${label}의 화살표 래퍼가 없습니다.`);
      expect(wrapper).toHaveClass('relative');

      const chevron = wrapper.querySelector('svg[aria-hidden="true"]');
      if (!chevron) throw new Error(`${label}의 장식용 화살표를 찾지 못했습니다.`);
      expect(chevron).toHaveClass('pointer-events-none', 'right-14');
    }
  });

  it('spaces the points-period and address-request chevrons while keeping native selects', () => {
    const pointsPage = renderMyPageSection('points');
    const periodSelect = screen.getByRole('combobox', { name: '조회 기간' });
    expect(periodSelect.tagName).toBe('SELECT');
    expect(periodSelect).toHaveClass('appearance-none', 'pr-32');
    expect(periodSelect.parentElement).toHaveClass('relative');
    expect(periodSelect.parentElement?.querySelector('svg[aria-hidden="true"]')).toHaveClass(
      'right-14',
    );
    pointsPage.unmount();

    renderMyPageSection('addresses');
    const addressLabel = screen.getAllByText(address.label)[0];
    if (!addressLabel) throw new Error('배송지 이름을 찾지 못했습니다.');
    const addressRow = addressLabel.closest('li');
    if (!addressRow) throw new Error('배송지 행을 찾지 못했습니다.');
    fireEvent.click(within(addressRow).getByRole('button', { name: '수정' }));
    const deliveryNoteSelect = screen.getByRole('combobox', { name: '배송 요청사항' });
    expect(deliveryNoteSelect.tagName).toBe('SELECT');
    expect(deliveryNoteSelect).toHaveClass('appearance-none', 'pr-40');
    expect(deliveryNoteSelect.parentElement).toHaveClass('relative', 'w-full');
    expect(deliveryNoteSelect.parentElement?.querySelector('svg[aria-hidden="true"]')).toHaveClass(
      'right-14',
    );
    expect(deliveryNoteSelect).toHaveValue('');
    expect(screen.getByRole('option', { name: '선택해 주세요' })).toHaveValue('');
    expect(screen.getByRole('option', { name: '배송 전 연락 바랍니다' })).toHaveValue(
      '배송 전 연락 바랍니다',
    );
    expect(screen.getByRole('option', { name: '문 앞에 놓아 주세요' })).toHaveValue(
      '문 앞에 놓아 주세요',
    );

    fireEvent.change(deliveryNoteSelect, { target: { value: '문 앞에 놓아 주세요' } });
    expect(deliveryNoteSelect).toHaveValue('문 앞에 놓아 주세요');
  });

  it('dims unselected reason cards and resets the selection when the claim type changes', () => {
    renderClaimApplication();

    const reasonGroup = screen.getByRole('radiogroup', { name: '사유' });
    expect(within(reasonGroup).getAllByRole('radio')).toHaveLength(5);
    const { radio: selectedRadio, card: selectedCard } = getReasonCard('단순 변심');
    const { card: unselectedCard } = getReasonCard('상품 불량·파손');
    expect(unselectedCard).toHaveClass('bg-bg', 'text-text-1');
    fireEvent.click(selectedRadio);

    expect(selectedRadio).toBeChecked();
    expect(selectedCard).toHaveClass('bg-bg', 'border-text-1', 'text-text-1');
    expect(unselectedCard).toHaveClass('bg-surface', 'border-line', 'text-text-2');
    expect(unselectedCard).toHaveClass('focus-within:ring-2', 'focus-within:ring-text-1');

    const claimTypeGroup = screen.getByRole('group', { name: '신청 종류' });
    fireEvent.click(within(claimTypeGroup).getByRole('button', { name: '취소' }));
    const resetReason = getReasonCard('주문 변경');

    expect(resetReason.radio).not.toBeChecked();
    expect(resetReason.card).toHaveClass('bg-bg', 'text-text-1');
  });
});

describe('MyPageScreen claim list', () => {
  it('keeps the claim detail link target at least 44px high', () => {
    renderMyPageSection('claims');

    const claimLink = screen.getByRole('link', { name: '신청 상세' });
    expect(claimLink).toHaveAttribute('href', '/mypage/claims/claim-1');
    expect(claimLink).toHaveClass('min-h-44');
  });
});
