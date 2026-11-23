import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AdminMemberDetailPage } from './AdminMemberDetailPage';
import { AdminOrderDetailPage } from './AdminOrderDetailPage';
import { AdminCouponsPage } from './AdminCouponsPage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminWithdrawnMemberDetailPage } from './AdminWithdrawnMemberDetailPage';

const shopMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  membersList: vi.fn(),
  ordersList: vi.fn(),
  couponsAdminList: vi.fn(),
  couponsSaveAdmin: vi.fn(),
  orderGet: vi.fn(),
  claimsList: vi.fn(),
  settingsGetAdmin: vi.fn(),
  settingsSaveAdmin: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: shopMocks.getShopApi }));

function renderSettings() {
  const settings = {
    baseShippingFee: 3000,
    baseFeeMode: 'customer',
    freeShippingEnabled: true,
    freeShippingThreshold: 50000,
    freeShippingScope: 'all',
    remoteFeeEnabled: true,
    jejuFee: 0,
    islandFee: 0,
    returnFee: 0,
    exchangeFee: 0,
    combineReturnShipping: true,
    businessDiscountEnabled: false,
    businessDiscountRate: 0,
    businessDiscountScope: 'direct',
    businessCouponStacking: false,
    firstPurchaseEnabled: false,
    firstPurchaseBenefitType: 'rate',
    firstPurchaseBenefitValue: 0,
    firstPurchaseMaxDiscount: 0,
    firstPurchaseMinimumOrder: 0,
    firstPurchasePaymentScope: 'all',
  };
  shopMocks.settingsGetAdmin.mockResolvedValue(settings);
  shopMocks.settingsSaveAdmin.mockImplementation((input: unknown) => Promise.resolve(input));
  shopMocks.getShopApi.mockResolvedValue({
    settings: { getAdmin: shopMocks.settingsGetAdmin, saveAdmin: shopMocks.settingsSaveAdmin },
  });
  const router = createMemoryRouter([
    { path: '/', element: <AdminSettingsPage /> },
    { path: '/next', element: <p>다음 화면</p> },
  ]);
  return {
    router,
    ...render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

describe('Admin demo preview flows', () => {
  it('shows a navigation warning only while settings differ from the current preview', async () => {
    const user = userEvent.setup();
    const { router } = renderSettings();
    const shippingFeeInput = await screen.findByLabelText('기본 배송비(원)');
    await user.clear(shippingFeeInput);
    await user.type(shippingFeeInput, '4000');
    expect(screen.getAllByText('저장되지 않은 변경 사항이 있습니다.').length).toBeGreaterThan(0);
    await router.navigate('/next');
    expect(
      await screen.findByRole('dialog', { name: '저장하지 않은 변경 사항이 있습니다' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '계속 편집' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks a negative settings preview from being saved', async () => {
    const user = userEvent.setup();
    renderSettings();
    const shippingFeeInput = await screen.findByLabelText('기본 배송비(원)');
    await user.clear(shippingFeeInput);
    await user.type(shippingFeeInput, '-1');
    expect(screen.getByRole('button', { name: '설정 저장' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('0 이상 숫자로 입력해 주세요');
  });

  it('validates coupon registration and saves the operating coupon to ShopApi', async () => {
    const user = userEvent.setup();
    const coupons: unknown[] = [];
    shopMocks.couponsAdminList.mockImplementation(() => Promise.resolve([...coupons]));
    shopMocks.couponsSaveAdmin.mockImplementation((input: unknown) => {
      const coupon = { ...(input as object), id: 'coupon-created', issuedCount: 0, usedCount: 0 };
      coupons.unshift(coupon);
      return Promise.resolve(coupon);
    });
    shopMocks.getShopApi.mockResolvedValue({
      coupons: { adminList: shopMocks.couponsAdminList, saveAdmin: shopMocks.couponsSaveAdmin },
    });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AdminCouponsPage />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('button', { name: '쿠폰 등록' }));
    await user.click(screen.getByRole('button', { name: '쿠폰 저장' }));
    expect(screen.getByText('쿠폰명을 입력해 주세요.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('쿠폰명'), '화면 전용 쿠폰');
    await user.selectOptions(screen.getByLabelText('발급 방식'), 'download');
    await user.selectOptions(screen.getByLabelText('대상 회원'), 'personal');
    await user.selectOptions(screen.getByLabelText('적용 상품'), 'products');
    await user.clear(screen.getByLabelText('최대 발급 수량'));
    await user.type(screen.getByLabelText('최대 발급 수량'), '42');
    await user.click(screen.getByLabelText('다른 할인과 중복 사용'));
    await user.type(screen.getByLabelText('혜택 값'), '10');
    await user.type(screen.getByLabelText('최대 할인 금액'), '2000');
    await user.type(screen.getByLabelText('최소 주문 금액'), '15000');
    const noticeInput = screen.getByText('안내 문구').parentElement?.querySelector('textarea');
    if (!noticeInput) throw new Error('쿠폰 안내 입력을 찾을 수 없습니다.');
    fireEvent.change(noticeInput, { target: { value: '이 화면 전용 안내' } });
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-10-15' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByRole('button', { name: '쿠폰 저장' }));
    expect(await screen.findByText('화면 전용 쿠폰')).toBeInTheDocument();
    expect(screen.getByText('이 화면 전용 안내')).toBeInTheDocument();
    expect(screen.getByText('최대 할인 2,000원')).toBeInTheDocument();
    expect(screen.getByText('최소 주문 15,000원')).toBeInTheDocument();
    expect(screen.getAllByText('다운로드').length).toBeGreaterThan(0);
    expect(screen.getByText('개인 · 상품 선택')).toBeInTheDocument();
    expect(screen.getByText('제한 42')).toBeInTheDocument();
    expect(screen.getAllByText('중복 가능').length).toBeGreaterThan(0);
    expect(screen.getByText(/자동 쿠폰은 구매자 쿠폰 조회 시 발급되고/)).toBeInTheDocument();
    expect(shopMocks.couponsSaveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '화면 전용 쿠폰',
        notice: '이 화면 전용 안내',
      }),
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('requires the exact 탈퇴 confirmation phrase and keeps account data unchanged', async () => {
    const user = userEvent.setup();
    shopMocks.membersList.mockResolvedValue([
      {
        id: 'member-a',
        name: '회원 A',
        email: 'member@example.com',
        phone: '010-0000-0000',
        joinedAt: '2025-01-01T00:00:00Z',
        pointBalance: 0,
      },
    ]);
    shopMocks.ordersList.mockResolvedValue([]);
    shopMocks.getShopApi.mockResolvedValue({
      members: { adminList: shopMocks.membersList },
      orders: { adminList: shopMocks.ordersList },
    });
    const router = createMemoryRouter(
      [{ path: '/members/:memberId', element: <AdminMemberDetailPage /> }],
      { initialEntries: ['/members/member-a'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('button', { name: '탈퇴 처리 안내' }));
    expect(await screen.findByText('주문 이력 (0)')).toBeInTheDocument();
    expect(screen.getByText('주문 이력이 없습니다')).toBeInTheDocument();
    const confirmButton = screen.getByRole('button', { name: '확인 미리보기' });
    expect(confirmButton).toBeDisabled();
    await user.type(screen.getByLabelText(/계속하려면/), '탈퇴 처리');
    expect(confirmButton).toBeDisabled();
    await user.clear(screen.getByLabelText(/계속하려면/));
    await user.type(screen.getByLabelText(/계속하려면/), '탈퇴');
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    expect(
      await screen.findByText(
        '탈퇴 처리는 실행되지 않았습니다. 실제 회원 데이터는 변경되지 않았습니다.',
      ),
    ).toBeInTheDocument();
    expect(shopMocks.membersList).toHaveBeenCalledTimes(1);
  });

  it('shows member scoped order lists from Admin APIs after loading', async () => {
    shopMocks.membersList.mockResolvedValue([
      {
        id: 'member-a',
        name: '회원 A',
        email: 'a@example.com',
        phone: '',
        joinedAt: '2025-01-01T00:00:00Z',
        pointBalance: 0,
      },
    ]);
    shopMocks.ordersList.mockResolvedValue([
      {
        id: 'order-a',
        orderNumber: '20261018-0001',
        orderedAt: '2026-10-18T00:00:00Z',
        status: 'paid',
        memberId: 'member-a',
        lines: [{ productName: '안전모' }],
        paymentTotal: 12000,
      },
      {
        id: 'order-b',
        orderNumber: '20261018-0002',
        orderedAt: '2026-10-18T00:00:00Z',
        status: 'paid',
        memberId: 'other-member',
        lines: [{ productName: '안전화' }],
        paymentTotal: 24000,
      },
    ]);
    shopMocks.getShopApi.mockResolvedValue({
      members: { adminList: shopMocks.membersList },
      orders: { adminList: shopMocks.ordersList },
    });
    const router = createMemoryRouter(
      [{ path: '/members/:memberId', element: <AdminMemberDetailPage /> }],
      { initialEntries: ['/members/member-a'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('주문 이력 (1)')).toBeInTheDocument();
    expect(screen.getByText('20261018-0001')).toBeInTheDocument();
    expect(screen.queryByText('20261018-0002')).not.toBeInTheDocument();
  });

  it('shows a settled error state when member order history requests fail', async () => {
    shopMocks.membersList.mockResolvedValue([
      {
        id: 'member-a',
        name: '회원 A',
        email: 'a@example.com',
        phone: '',
        joinedAt: '2025-01-01T00:00:00Z',
        pointBalance: 0,
      },
    ]);
    shopMocks.ordersList.mockRejectedValue(new Error('주문 조회 실패'));
    shopMocks.getShopApi.mockResolvedValue({
      members: { adminList: shopMocks.membersList },
      orders: { adminList: shopMocks.ordersList },
    });
    const router = createMemoryRouter(
      [{ path: '/members/:memberId', element: <AdminMemberDetailPage /> }],
      { initialEntries: ['/members/member-a'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('주문 이력을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('주문 이력을 불러오고 있습니다.')).not.toBeInTheDocument();
  });

  it('shows the pending order history state until its Admin request settles', async () => {
    let resolveOrders: ((orders: never[]) => void) | undefined;
    const pendingOrders = new Promise<never[]>((resolve) => {
      resolveOrders = resolve;
    });
    shopMocks.membersList.mockResolvedValue([
      {
        id: 'member-a',
        name: '회원 A',
        email: 'a@example.com',
        phone: '',
        joinedAt: '2025-01-01T00:00:00Z',
        pointBalance: 0,
      },
    ]);
    shopMocks.ordersList.mockReturnValue(pendingOrders);
    shopMocks.getShopApi.mockResolvedValue({
      members: { adminList: shopMocks.membersList },
      orders: { adminList: shopMocks.ordersList },
    });
    const router = createMemoryRouter(
      [{ path: '/members/:memberId', element: <AdminMemberDetailPage /> }],
      { initialEntries: ['/members/member-a'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('주문 이력을 불러오고 있습니다.')).toBeInTheDocument();
    resolveOrders?.([]);
    expect(await screen.findByText('주문 이력 (0)')).toBeInTheDocument();
    expect(screen.queryByText('주문 이력을 불러오고 있습니다.')).not.toBeInTheDocument();
  });

  it('renders only masked synthetic purchase and memo records on withdrawn details', () => {
    const router = createMemoryRouter(
      [{ path: '/members/withdrawn/:memberId', element: <AdminWithdrawnMemberDetailPage /> }],
      { initialEntries: ['/members/withdrawn/admin-demo-withdrawn-001'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByText('010-****-0001')).toBeInTheDocument();
    expect(screen.getByText('ex*****@email.com')).toBeInTheDocument();
    expect(screen.getByText('주문 이력 (2)')).toBeInTheDocument();
    expect(screen.getByText('재가입 가능 예정일')).toBeInTheDocument();
    expect(screen.getByText('2026-11-14')).toBeInTheDocument();
    expect(screen.getByText(/합성 데모 기록입니다/)).toBeInTheDocument();
  });

  it('clears cancellation reason when the confirmation dialog is dismissed', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'order-a',
      orderNumber: 'ORDER-A',
      orderedAt: '2026-10-01T00:00:00Z',
      status: 'paid',
      memberId: 'member-a',
      lines: [],
      productTotal: 1000,
      shippingFee: 0,
      discountTotal: 0,
      pointUsed: 0,
      paymentTotal: 1000,
      shippingAddress: {
        recipientName: '수령인',
        phone: '010-0000-0000',
        postalCode: '00000',
        address1: '주소',
        address2: '',
      },
    };
    shopMocks.orderGet.mockResolvedValue(order);
    shopMocks.membersList.mockResolvedValue([
      { id: 'member-a', name: '회원 A', email: 'member@example.com', phone: '010-0000-0000' },
    ]);
    shopMocks.claimsList.mockResolvedValue([
      {
        id: 'claim-a',
        orderId: 'order-a',
        type: 'cancel',
        status: 'requested',
        reason: '고객 요청',
        requestedAt: '2026-10-02T00:00:00Z',
      },
    ]);
    shopMocks.getShopApi.mockResolvedValue({
      orders: { getById: shopMocks.orderGet },
      members: { adminList: shopMocks.membersList },
      claims: { listByMember: shopMocks.claimsList },
    });
    const router = createMemoryRouter(
      [{ path: '/orders/:orderId', element: <AdminOrderDetailPage /> }],
      { initialEntries: ['/orders/order-a'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('button', { name: '취소 요청 처리' }));
    const cancellationDialog = screen.getByRole('dialog');
    expect(within(cancellationDialog).getByText('환불 금액')).toBeInTheDocument();
    expect(within(cancellationDialog).getByText('₩1,000')).toBeInTheDocument();
    expect(
      within(cancellationDialog).getByText(
        /실제 처리에서는 주문 취소와 결제 취소·환불이 진행될 수 있습니다/,
      ),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/취소 사유/), '요청 내용 확인');
    await user.click(screen.getByRole('button', { name: '취소' }));
    await user.click(screen.getByRole('button', { name: '취소 요청 처리' }));
    expect(screen.getByLabelText(/취소 사유/)).toHaveValue('');
    expect(screen.getByText('처리 이력 데이터가 없습니다')).toBeInTheDocument();
  });

  it('renders actual Admin order status history and only the fields supplied by the API', async () => {
    const adminOrder = {
      id: 'order-history',
      orderNumber: 'ORDER-HISTORY',
      orderedAt: '2026-10-01T09:00:00Z',
      status: 'shipping',
      memberId: 'member-a',
      lines: [],
      productTotal: 1000,
      shippingFee: 0,
      discountTotal: 0,
      pointUsed: 0,
      paymentTotal: 1000,
      shippingAddress: {
        recipientName: '수령인',
        phone: '010-0000-0000',
        postalCode: '00000',
        address1: '주소',
        address2: '',
      },
      trackingCarrier: null,
      trackingNumber: null,
      adminMemo: '',
      statusHistory: [
        { status: 'paid', occurredAt: '2026-10-01T09:05:00Z', note: '결제 확인' },
        { status: 'shipping', occurredAt: '2026-10-02T10:30:00Z', note: '송장 등록' },
      ],
    };
    shopMocks.orderGet.mockResolvedValue(adminOrder);
    shopMocks.membersList.mockResolvedValue([
      { id: 'member-a', name: '회원 A', email: 'member@example.com', phone: '010-0000-0000' },
    ]);
    shopMocks.claimsList.mockResolvedValue([]);
    shopMocks.getShopApi.mockResolvedValue({
      orders: { adminGetById: shopMocks.orderGet },
      members: { adminList: shopMocks.membersList },
      claims: { listByMember: shopMocks.claimsList },
    });
    const router = createMemoryRouter(
      [{ path: '/orders/:orderId', element: <AdminOrderDetailPage /> }],
      { initialEntries: ['/orders/order-history'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('결제 확인')).toBeInTheDocument();
    expect(screen.getByText('송장 등록')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '변경 일시' })).toBeInTheDocument();
    expect(screen.queryByText('관리자')).not.toBeInTheDocument();
    expect(screen.queryByText('처리 이력 데이터가 없습니다')).not.toBeInTheDocument();
  });
});
