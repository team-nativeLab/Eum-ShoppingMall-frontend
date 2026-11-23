import type { Address, Claim, Member, Order } from '@eum/api/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { useLocalCollections } from '@/features/products/local-collections-context';
import { MyPageScreen } from './mypage-screen';
import { useMyPageData, type MyPageData } from './mypage-data';

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const apiMocks = vi.hoisted(() => ({ submitClaim: vi.fn(), listClaims: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerMock.push, replace: routerMock.replace }),
}));
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
  requestedAt: '2026-10-10T12:00:00+09:00',
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
  products: [],
  unavailableProductIds: [],
  loadWarnings: [],
};

function renderMyPageSection(
  section: 'claim-new' | 'claims' | 'points' | 'addresses' | 'profile' | 'profile-edit',
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
  routerMock.replace.mockReset();
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

describe('MyPageScreen signed-out entry', () => {
  it('keeps the mypage destination in the login link', () => {
    vi.mocked(useMemberSession).mockReturnValue({
      member: null,
      status: 'ready',
      refreshMember: async () => null,
      setMember: vi.fn(),
      clearMember: async () => undefined,
    });
    render(<MyPageScreen section="points" />);

    expect(
      screen
        .getAllByRole('link', { name: '로그인' })
        .map((loginLink) => loginLink.getAttribute('href')),
    ).toContain('/login?redirect=%2Fmypage');
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

describe('MyPageScreen profile reauthentication demo', () => {
  it('개인회원 정보 수정에서 사업자 정보는 없고 기본 정보와 수신 동의는 유지합니다', () => {
    const { rerender } = renderMyPageSection('profile');

    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'temporary-demo-value' },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    rerender(<MyPageScreen section="profile-edit" />);

    expect(screen.getByRole('heading', { name: '기본 정보' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '수신 동의' })).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    expect(screen.getByLabelText('휴대폰 번호')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'SMS 수신 동의' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '이메일 수신 동의' })).toBeInTheDocument();
    expect(screen.queryByText('사업자 정보')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('회사명')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('사업자등록번호')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('담당 부서')).not.toBeInTheDocument();
  });

  it('requires a password, grants the edit route after the demo step, and clears that grant on exit', async () => {
    const { rerender } = renderMyPageSection('profile');
    const passwordField = screen.getByLabelText('비밀번호');

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByRole('status')).toHaveTextContent('비밀번호를 입력해 주세요.');

    fireEvent.change(passwordField, { target: { value: 'temporary-demo-value' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(routerMock.push).toHaveBeenCalledWith('/mypage/profile/edit');
    expect(passwordField).toHaveValue('');
    expect(screen.getByText(/실제 본인 확인은 진행되지 않습니다/)).toBeInTheDocument();

    rerender(<MyPageScreen section="profile-edit" />);
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '임시 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('status')).toHaveTextContent('서버에는 저장되지 않습니다.');

    rerender(<MyPageScreen section="profile" />);
    rerender(<MyPageScreen section="profile-edit" />);
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mypage/profile'));
    expect(screen.queryByLabelText('이름')).not.toBeInTheDocument();
  });

  it('redirects direct edit-route entry to the profile screen without showing editable fields', async () => {
    renderMyPageSection('profile-edit');

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mypage/profile'));
    expect(screen.queryByLabelText('이름')).not.toBeInTheDocument();
  });

  it('redirects a signed-out direct edit route to login', async () => {
    vi.mocked(useMemberSession).mockReturnValue({
      member: null,
      status: 'ready',
      refreshMember: async () => null,
      setMember: vi.fn(),
      clearMember: async () => undefined,
    });
    const { rerender } = renderMyPageSection('profile-edit');

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mypage/profile'));
    rerender(<MyPageScreen section="profile" />);
    expect(
      screen
        .getAllByRole('link', { name: '로그인' })
        .some((loginLink) => loginLink.getAttribute('href') === '/login?redirect=%2Fmypage'),
    ).toBe(true);
  });
});
