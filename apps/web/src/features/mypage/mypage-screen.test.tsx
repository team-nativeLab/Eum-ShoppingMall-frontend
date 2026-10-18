import type { Address, Claim, Member, Order, Quote } from '@eum/api/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { useLocalCollections } from '@/features/products/local-collections-context';
import { MyPageScreen } from './mypage-screen';
import { useMyPageData, type MyPageData } from './mypage-data';

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
const apiMocks = vi.hoisted(() => ({ submitClaim: vi.fn(), listClaims: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerMock.push }) }));
vi.mock('@/features/auth/member-session', () => ({ useMemberSession: vi.fn() }));
vi.mock('@/features/products/local-collections-context', () => ({
  useLocalCollections: vi.fn(),
}));
vi.mock('@/lib/shop-api', () => ({
  getShopApi: async () => ({
    claims: { submit: apiMocks.submitClaim, listByMember: apiMocks.listClaims },
  }),
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
  couponOffers: [],
  points: [],
  addresses: [address],
  quotes: [],
  products: [],
  unavailableProductIds: [],
  loadWarnings: [],
};

function renderMyPageSection(
  section: 'claim-new' | 'claims' | 'points' | 'addresses' | 'quote-detail',
) {
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
  apiMocks.submitClaim.mockReset().mockResolvedValue({ id: 'claim-web-001' });
  apiMocks.listClaims.mockReset().mockResolvedValue([{ ...claim, id: 'claim-web-001' }]);
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
    const payableOrder = { ...order, id: 'order-paid', status: 'paid' as const };
    vi.mocked(useMyPageData).mockReturnValue({
      data: { ...myPageData, orders: [order, payableOrder] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    render(<MyPageScreen section="claim-new" />);

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
    fireEvent.change(screen.getByRole('combobox', { name: '주문 선택' }), {
      target: { value: payableOrder.id },
    });
    const resetReason = getReasonCard('주문 변경');

    expect(resetReason.radio).not.toBeChecked();
    expect(resetReason.card).toHaveClass('bg-bg', 'text-text-1');
  });

  it('submits the selected order claim and verifies it through the buyer claim list', async () => {
    const { container } = renderClaimApplication();
    fireEvent.click(screen.getByRole('checkbox', { name: '안전모 선택' }));
    fireEvent.click(getReasonCard('상품 불량·파손').radio);
    fireEvent.click(screen.getByRole('radio', { name: '직접 발송' }));
    const attachment = new File(['sample'], 'damage.jpg', { type: 'image/jpeg' });
    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error('클레임 첨부 입력을 찾을 수 없습니다.');
    fireEvent.change(fileInput, { target: { files: [attachment] } });
    fireEvent.change(screen.getByPlaceholderText('상세 사유를 입력해 주세요.'), {
      target: { value: '상품이 파손되어 도착했습니다.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    await waitFor(() =>
      expect(apiMocks.submitClaim).toHaveBeenCalledWith({
        orderId: 'order-1',
        type: 'return',
        reason: '상품 불량·파손',
        description: '상품이 파손되어 도착했습니다.',
        items: [{ productId: 'product-1', quantity: 2 }],
        returnMethod: 'direct',
        returnAddress: {
          recipientName: '목 회원',
          phone: '010-0000-0000',
          postalCode: '00000',
          address1: '서울시',
          address2: '마포구',
        },
        attachments: [{ fileName: 'damage.jpg', mimeType: 'image/jpeg', sizeBytes: 6 }],
      }),
    );
    expect(apiMocks.listClaims).toHaveBeenCalledWith(member.id);
    expect(await screen.findByText(/신청번호 claim-web-001/)).toBeInTheDocument();
  });

  it('opens the cancel request mode for an eligible order and submits it through the buyer API', async () => {
    const payableOrder = { ...order, status: 'paid' as const };
    vi.mocked(useMyPageData).mockReturnValue({
      data: { ...myPageData, orders: [payableOrder] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(
      <MyPageScreen section="claim-new" itemId={payableOrder.id} preferredClaimType="cancel" />,
    );

    expect(
      within(screen.getByRole('group', { name: '신청 종류' })).getByRole('button', {
        name: '취소',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: '안전모 선택' }));
    fireEvent.click(getReasonCard('주문 변경').radio);
    fireEvent.change(screen.getByPlaceholderText('상세 사유를 입력해 주세요.'), {
      target: { value: '주문을 잘못했습니다.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    await waitFor(() =>
      expect(apiMocks.submitClaim).toHaveBeenCalledWith({
        orderId: payableOrder.id,
        type: 'cancel',
        reason: '주문 변경',
        description: '주문을 잘못했습니다.',
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
    );
    expect(apiMocks.listClaims).toHaveBeenCalledWith(member.id);
    expect(await screen.findByText(/신청번호 claim-web-001/)).toBeInTheDocument();
  });

  it('limits orders by claim type and clears an order that is no longer eligible', () => {
    const claimOrders: Order[] = [
      ...(['paymentPending', 'paid', 'preparing'] as const).map((status) => ({
        ...order,
        id: `order-${status}`,
        orderNumber: `ORD-${status}`,
        status,
      })),
      ...(['shipping', 'delivered'] as const).map((status) => ({
        ...order,
        id: `order-${status}`,
        orderNumber: `ORD-${status}`,
        status,
      })),
    ];
    const shippingOrder = claimOrders.find((candidate) => candidate.status === 'shipping');
    if (!shippingOrder) throw new Error('배송 중 주문 fixture가 필요합니다.');
    vi.mocked(useMyPageData).mockReturnValue({
      data: { ...myPageData, orders: claimOrders },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(<MyPageScreen section="claim-new" itemId={shippingOrder.id} />);

    const orderSelect = screen.getByRole('combobox', { name: '주문 선택' });
    expect(within(orderSelect).getByRole('option', { name: /ORD-shipping/ })).toBeInTheDocument();
    expect(within(orderSelect).getByRole('option', { name: /ORD-delivered/ })).toBeInTheDocument();
    expect(
      within(orderSelect).queryByRole('option', { name: /ORD-paymentPending/ }),
    ).not.toBeInTheDocument();
    expect(within(orderSelect).queryByRole('option', { name: /ORD-paid/ })).not.toBeInTheDocument();
    expect(
      within(orderSelect).queryByRole('option', { name: /ORD-preparing/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole('group', { name: '신청 종류' })).getByRole('button', {
        name: '취소',
      }),
    );

    expect(orderSelect).toHaveValue('');
    expect(
      within(orderSelect).getByRole('option', { name: /ORD-paymentPending/ }),
    ).toBeInTheDocument();
    expect(within(orderSelect).getByRole('option', { name: /ORD-paid/ })).toBeInTheDocument();
    expect(within(orderSelect).getByRole('option', { name: /ORD-preparing/ })).toBeInTheDocument();
    expect(
      within(orderSelect).queryByRole('option', { name: /ORD-shipping/ }),
    ).not.toBeInTheDocument();
    expect(
      within(orderSelect).queryByRole('option', { name: /ORD-delivered/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '취소 신청은 입금대기·결제완료·배송준비 주문',
    );
  });

  it('shows one eligibility notice when changing type leaves no valid orders', () => {
    const shippingOrder = { ...order, status: 'shipping' as const };
    vi.mocked(useMyPageData).mockReturnValue({
      data: { ...myPageData, orders: [shippingOrder] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    render(<MyPageScreen section="claim-new" itemId={shippingOrder.id} />);

    fireEvent.click(
      within(screen.getByRole('group', { name: '신청 종류' })).getByRole('button', {
        name: '취소',
      }),
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('현재 신청 가능한 주문이 없습니다.');
    expect(screen.getByRole('combobox', { name: '주문 선택' })).toHaveValue('');
  });
});

describe('MyPageScreen quote detail', () => {
  it('shows the member quote request body, items, and safe attachment metadata', () => {
    const quote: Quote = {
      id: 'quote-1',
      title: '대량 납품 문의',
      companyName: '테스트 회사',
      contactName: '담당자',
      status: 'received',
      requestedAt: '2026-10-12T00:00:00+09:00',
      memberId: member.id,
      inquiryBody: '현장 납품 일정을 문의합니다.',
      requestedItems: [{ name: '안전모', quantity: 12, option: '색상: 흰색' }],
      attachments: [
        { id: 'attachment-1', fileName: 'spec.pdf', mimeType: 'application/pdf', sizeBytes: 2048 },
      ],
    };
    vi.mocked(useMyPageData).mockReturnValue({
      data: { ...myPageData, quotes: [quote] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(<MyPageScreen section="quote-detail" itemId={quote.id} />);

    expect(screen.getByText('현장 납품 일정을 문의합니다.')).toBeInTheDocument();
    expect(screen.getByText('안전모')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('spec.pdf (2KB)')).toBeInTheDocument();
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
