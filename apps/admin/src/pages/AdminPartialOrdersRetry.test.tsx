import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@eum/api/types';
import {
  createAdminRequestScope,
  endAdminSession,
  startAdminSession,
} from '@/lib/admin-request-lifecycle';
import { AdminTopBar } from '@/components/AdminTopBar';
import { AdminDashboardPage } from './AdminDashboardPage';
import { LoginPage } from './LoginPage';
import { AdminOrdersPage } from './AdminOrdersPage';

const memberA = {
  id: 'member-a',
  name: '회원 A',
  email: 'member-a@example.com',
  phone: '010-0000-0001',
  joinedAt: '2024-01-01T00:00:00.000Z',
  pointBalance: 100,
};
const memberB = {
  id: 'member-b',
  name: '회원 B',
  email: 'member-b@example.com',
  phone: '010-0000-0002',
  joinedAt: '2024-01-02T00:00:00.000Z',
  pointBalance: 200,
};
const memberC = {
  id: 'member-c',
  name: '회원 C',
  email: 'member-c@example.com',
  phone: '010-0000-0003',
  joinedAt: '2024-01-03T00:00:00.000Z',
  pointBalance: 300,
};

function createOrder(memberId: string, orderNumber: string): Order {
  return {
    id: orderNumber,
    orderNumber,
    orderedAt: '2026-10-14T12:00:00.000Z',
    status: 'paid',
    memberId,
    lines: [
      {
        productId: `product-${memberId}`,
        productName: '테스트 상품',
        unitPrice: 1000,
        quantity: 1,
      },
    ],
    productTotal: 1000,
    shippingFee: 0,
    discountTotal: 0,
    pointUsed: 0,
    paymentTotal: 1000,
    shippingAddress: {
      id: `address-${memberId}`,
      label: '기본 배송지',
      recipientName: '테스트 수령인',
      phone: '010-0000-0000',
      postalCode: '00000',
      address1: '서울시 테스트구',
      address2: '',
      isDefault: true,
    },
  };
}

function setupTwoMemberOrderResponses(retryMemberB: 'success' | 'failure') {
  apiMocks.membersList.mockResolvedValue([memberA, memberB]);
  let memberBRequestCount = 0;
  apiMocks.listOrdersByMember.mockImplementation((memberId: string) => {
    if (memberId === memberA.id) return Promise.resolve([createOrder(memberA.id, 'ORDER-A')]);
    if (memberId === memberB.id) {
      memberBRequestCount += 1;
      if (memberBRequestCount === 1 || retryMemberB === 'failure') {
        return Promise.reject(new Error('회원 B 주문 API 일시 오류'));
      }
      return Promise.resolve([createOrder(memberB.id, 'ORDER-B')]);
    }
    return Promise.resolve([]);
  });
}

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  membersList: vi.fn(),
  listOrdersByMember: vi.fn(),
  listProducts: vi.fn(),
  listQuotes: vi.fn(),
}));
const adminAuthMocks = vi.hoisted(() => ({
  getAdminAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({
  getShopApi: apiMocks.getShopApi,
}));

vi.mock('@/lib/api-config', () => ({
  getAdminApiConfig: () => ({ mode: 'mock' }),
}));
vi.mock('@/lib/admin-auth', () => ({
  currentAdminQueryKey: ['admin', 'current-user'],
  getAdminAuth: adminAuthMocks.getAdminAuth,
}));

function renderWithAdminProviders(page: ReactNode, queryClient = createAdminQueryClient()) {
  const renderedPage = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </MemoryRouter>,
  );

  return { ...renderedPage, queryClient };
}

function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
}

describe('partial order lookup retry actions', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    Object.values(adminAuthMocks).forEach((mock) => mock.mockReset());
    startAdminSession();
    adminAuthMocks.getCurrentUser.mockResolvedValue({
      id: 'admin-a',
      loginId: 'admin-a',
      name: '관리자 A',
      role: 'owner',
    });
    adminAuthMocks.login.mockResolvedValue({
      id: 'admin-a',
      loginId: 'admin-a',
      name: '관리자 A',
      role: 'owner',
    });
    adminAuthMocks.logout.mockResolvedValue(undefined);
    adminAuthMocks.getAdminAuth.mockResolvedValue({
      getCurrentUser: adminAuthMocks.getCurrentUser,
      login: adminAuthMocks.login,
      logout: adminAuthMocks.logout,
    });
    apiMocks.membersList.mockResolvedValue([
      { id: 'member-a', name: '목 회원', email: 'member@example.com', phone: '010-0000-0000' },
    ]);
    apiMocks.listOrdersByMember.mockResolvedValue([]);
    apiMocks.listProducts.mockResolvedValue({ items: [], totalCount: 0 });
    apiMocks.listQuotes.mockResolvedValue([]);
    apiMocks.getShopApi.mockResolvedValue({
      members: { list: apiMocks.membersList },
      orders: { listByMember: apiMocks.listOrdersByMember },
      products: { list: apiMocks.listProducts },
      quotes: { list: apiMocks.listQuotes },
    });
  });

  it('retries member order lookups from the Orders warning', async () => {
    const user = userEvent.setup();
    const retryOrders = createDeferred<never[]>();
    apiMocks.listOrdersByMember
      .mockRejectedValueOnce(new Error('주문 API 일시 오류'))
      .mockReturnValueOnce(retryOrders.promise);

    renderWithAdminProviders(<AdminOrdersPage />);

    const retryButton = await screen.findByRole('button', { name: '다시 조회' });
    await user.click(retryButton);

    await waitFor(() => expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(2));
    expect(screen.getByText('회원별 주문을 다시 조회하고 있습니다.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByText('회원별 주문을 다시 조회하고 있습니다.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByRole('button', { name: '조회 중…' })).toBeDisabled();
    await user.click(retryButton);
    expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(2);

    retryOrders.resolve([]);
    expect(
      await screen.findByText('회원별 주문 재조회가 완료되었습니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('retries only failed member B and preserves member A orders when B still fails in Orders', async () => {
    const user = userEvent.setup();
    setupTwoMemberOrderResponses('failure');

    renderWithAdminProviders(<AdminOrdersPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '다시 조회' }));

    expect(
      await screen.findByText('주문 재조회 후에도 회원 1명의 주문 조회에 실패했습니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /회원 1명의 주문 조회에 실패했습니다\. 현재 목록은 조회가 완료된 회원의 부분 결과입니다\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeEnabled();
    expect(apiMocks.listOrdersByMember.mock.calls.map(([memberId]) => memberId)).toEqual([
      memberA.id,
      memberB.id,
      memberB.id,
    ]);
  });

  it('merges retry member B orders with existing member A orders in Orders', async () => {
    const user = userEvent.setup();
    setupTwoMemberOrderResponses('success');

    const { queryClient } = renderWithAdminProviders(<AdminOrdersPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '다시 조회' }));

    expect(
      await screen.findByText('회원별 주문 재조회가 완료되었습니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-B' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).toBeNull();
    expect(apiMocks.listOrdersByMember.mock.calls.map(([memberId]) => memberId)).toEqual([
      memberA.id,
      memberB.id,
      memberB.id,
    ]);
    expect(apiMocks.membersList).toHaveBeenCalledTimes(1);
    const cachedOrders = queryClient.getQueryData<{
      orders: {
        orderNumber: string;
        memberId: string;
        lines: { productName: string }[];
      }[];
    }>(['admin', 'orders', 'list']);
    expect(
      cachedOrders?.orders.map(({ orderNumber, memberId }) => ({ orderNumber, memberId })),
    ).toEqual([
      { orderNumber: 'ORDER-A', memberId: memberA.id },
      { orderNumber: 'ORDER-B', memberId: memberB.id },
    ]);
    expect(
      cachedOrders?.orders.every((order) => order.lines[0]?.productName === '테스트 상품'),
    ).toBe(true);
    expect(cachedOrders?.orders[1]).not.toHaveProperty('shippingAddress');
    expect(cachedOrders?.orders[1]?.lines[0]).not.toHaveProperty('unitPrice');
  });

  it('keeps the Orders data and warning when the retry API client cannot be loaded', async () => {
    const user = userEvent.setup();
    setupTwoMemberOrderResponses('failure');

    renderWithAdminProviders(<AdminOrdersPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    apiMocks.getShopApi.mockRejectedValueOnce(new Error('API client unavailable'));
    await user.click(await screen.findByRole('button', { name: '다시 조회' }));

    expect(
      await screen.findByText('주문 재조회에 실패했습니다. 기존 목록과 경고를 유지합니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeEnabled();
    expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(2);
    expect(apiMocks.membersList).toHaveBeenCalledTimes(1);
  });

  it('retries member order lookups from the Dashboard warning', async () => {
    const user = userEvent.setup();
    const retryOrders = createDeferred<never[]>();
    apiMocks.listOrdersByMember
      .mockRejectedValueOnce(new Error('주문 API 일시 오류'))
      .mockReturnValueOnce(retryOrders.promise);

    renderWithAdminProviders(<AdminDashboardPage />);

    const retryButton = await screen.findByRole('button', { name: '주문 다시 조회' });
    await user.click(retryButton);

    await waitFor(() => expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(2));
    expect(screen.getByText('회원별 주문을 다시 조회하고 있습니다.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByText('회원별 주문을 다시 조회하고 있습니다.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByRole('button', { name: '조회 중…' })).toBeDisabled();
    await user.click(retryButton);
    expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(2);

    retryOrders.resolve([]);
    expect(
      await screen.findByText('회원별 주문 재조회가 완료되었습니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '주문 다시 조회' })).toBeNull();
  });

  it('retries only failed member B and preserves member A orders when B still fails in Dashboard', async () => {
    const user = userEvent.setup();
    setupTwoMemberOrderResponses('failure');

    renderWithAdminProviders(<AdminDashboardPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '주문 다시 조회' }));

    expect(
      await screen.findByText('주문 재조회 후에도 회원 1명의 주문 조회에 실패했습니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    expect(
      screen.getByText(/회원 1명의 주문 조회에 실패해 부분 결과만 표시합니다\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '주문 다시 조회' })).toBeEnabled();
    expect(apiMocks.listOrdersByMember.mock.calls.map(([memberId]) => memberId)).toEqual([
      memberA.id,
      memberB.id,
      memberB.id,
    ]);
    expect(apiMocks.membersList).toHaveBeenCalledTimes(1);
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(1);
    expect(apiMocks.listQuotes).toHaveBeenCalledTimes(1);
  });

  it('merges retry member B orders with existing member A orders in Dashboard', async () => {
    const user = userEvent.setup();
    setupTwoMemberOrderResponses('success');

    renderWithAdminProviders(<AdminDashboardPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '주문 다시 조회' }));

    expect(
      await screen.findByText('회원별 주문 재조회가 완료되었습니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-B' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '주문 다시 조회' })).toBeNull();
    expect(apiMocks.listOrdersByMember.mock.calls.map(([memberId]) => memberId)).toEqual([
      memberA.id,
      memberB.id,
      memberB.id,
    ]);
    expect(apiMocks.membersList).toHaveBeenCalledTimes(1);
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(1);
    expect(apiMocks.listQuotes).toHaveBeenCalledTimes(1);
  });

  it('keeps only the Dashboard fields needed for its member and order summaries in cache', async () => {
    setupTwoMemberOrderResponses('failure');
    apiMocks.listQuotes.mockResolvedValue([
      {
        id: 'quote-1',
        status: 'received',
        companyName: '민감 회사명 테스트',
        contactName: '민감 담당자 테스트',
      },
    ]);
    const { queryClient } = renderWithAdminProviders(<AdminDashboardPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();

    const cachedDashboard = queryClient.getQueryData<{
      membersById: Map<string, { id: string; name: string }>;
      pendingQuoteCount: number;
      orders: {
        order: Pick<
          Order,
          'id' | 'orderNumber' | 'orderedAt' | 'status' | 'memberId' | 'paymentTotal'
        >;
        member: { id: string; name: string } | undefined;
      }[];
    }>(['admin', 'dashboard']);

    expect([...(cachedDashboard?.membersById.values() ?? [])]).toEqual([
      { id: memberA.id, name: memberA.name },
      { id: memberB.id, name: memberB.name },
    ]);
    expect(cachedDashboard?.orders[0]?.member).toEqual({ id: memberA.id, name: memberA.name });
    expect(cachedDashboard?.orders[0]?.order).toEqual({
      id: 'ORDER-A',
      orderNumber: 'ORDER-A',
      orderedAt: '2026-10-14T12:00:00.000Z',
      status: 'paid',
      memberId: memberA.id,
      paymentTotal: 1000,
    });
    expect(cachedDashboard?.pendingQuoteCount).toBe(1);
    expect(queryClient.getQueryData(['admin', 'dashboard'])).not.toHaveProperty('quotes');
    expect(JSON.stringify(queryClient.getQueryData(['admin', 'dashboard']))).not.toContain(
      '민감 회사명 테스트',
    );
    expect(JSON.stringify(queryClient.getQueryData(['admin', 'dashboard']))).not.toContain(
      '민감 담당자 테스트',
    );
    expect(
      [
        ...(cachedDashboard?.membersById.values() ?? []),
        ...(cachedDashboard?.orders.flatMap(({ member }) => (member ? [member] : [])) ?? []),
      ].flatMap((member) => Object.keys(member)),
    ).not.toEqual(expect.arrayContaining(['email', 'phone', 'joinedAt', 'pointBalance']));
  });

  it('keeps only the Orders member fields used for search and display in cache', async () => {
    setupTwoMemberOrderResponses('failure');
    const { queryClient } = renderWithAdminProviders(<AdminOrdersPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();

    const cachedOrders = queryClient.getQueryData<{
      orders: {
        id: string;
        orderNumber: string;
        orderedAt: string;
        status: Order['status'];
        memberId: string;
        paymentTotal: number;
        lines: { productName: string }[];
      }[];
      membersById: Map<string, { id: string; name: string; email: string; phone: string }>;
    }>(['admin', 'orders', 'list']);
    const cachedMembers = [...(cachedOrders?.membersById.values() ?? [])];

    expect(cachedMembers).toEqual([
      { id: memberA.id, name: memberA.name, email: memberA.email, phone: memberA.phone },
      { id: memberB.id, name: memberB.name, email: memberB.email, phone: memberB.phone },
    ]);
    expect(cachedMembers.flatMap((member) => Object.keys(member))).not.toEqual(
      expect.arrayContaining(['joinedAt', 'pointBalance']),
    );
    expect(cachedOrders?.orders[0]).toEqual({
      id: 'ORDER-A',
      orderNumber: 'ORDER-A',
      orderedAt: '2026-10-14T12:00:00.000Z',
      status: 'paid',
      memberId: memberA.id,
      paymentTotal: 1000,
      lines: [{ productName: '테스트 상품' }],
    });
    expect(cachedOrders?.orders[0]).not.toHaveProperty('shippingAddress');
    expect(cachedOrders?.orders[0]?.lines[0]).not.toHaveProperty('productId');
    expect(cachedOrders?.orders[0]?.lines[0]).not.toHaveProperty('unitPrice');
    expect(cachedOrders?.orders[0]?.lines[0]).not.toHaveProperty('quantity');
  });

  it('blocks retry scopes during logout and removes cached Admin data', async () => {
    const user = userEvent.setup();
    const pendingLogout = createDeferred<void>();
    adminAuthMocks.logout.mockReturnValue(pendingLogout.promise);
    const queryClient = createAdminQueryClient();
    queryClient.setQueryData(['admin', 'dashboard'], { session: 'admin-a' });
    const router = createMemoryRouter(
      [
        { path: '/', element: <AdminTopBar /> },
        { path: '/login', element: <p>로그인 화면</p> },
      ],
      { initialEntries: ['/'] },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('관리자 A')).toBeInTheDocument();
    const activeRetryScope = createAdminRequestScope();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(adminAuthMocks.logout).toHaveBeenCalledTimes(1));

    expect(activeRetryScope.signal.aborted).toBe(true);
    const retryScopeDuringLogout = createAdminRequestScope();
    expect(retryScopeDuringLogout.signal.aborted).toBe(true);
    expect(retryScopeDuringLogout.isCurrent()).toBe(false);
    expect(queryClient.getQueryData(['admin', 'dashboard'])).toEqual({ session: 'admin-a' });

    pendingLogout.resolve();
    expect(await screen.findByText('로그인 화면')).toBeInTheDocument();
    await waitFor(() => {
      expect(queryClient.getQueryData(['admin', 'dashboard'])).toBeUndefined();
    });
  });

  it('restores retry eligibility when logout fails but current-user validation succeeds', async () => {
    const user = userEvent.setup();
    adminAuthMocks.logout.mockRejectedValueOnce(new Error('로그아웃 API 오류'));
    const router = createMemoryRouter(
      [
        { path: '/', element: <AdminTopBar /> },
        { path: '/login', element: <LoginPage /> },
      ],
      { initialEntries: ['/'] },
    );

    render(
      <QueryClientProvider client={createAdminQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('관리자 A')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(adminAuthMocks.getCurrentUser).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('관리자 A')).toBeInTheDocument();

    const retryScope = createAdminRequestScope();
    expect(retryScope.signal.aborted).toBe(false);
    expect(retryScope.isCurrent()).toBe(true);
    retryScope.dispose();
  });

  it('keeps dashboard data and warning when the retry API client cannot be loaded', async () => {
    const user = userEvent.setup();
    setupTwoMemberOrderResponses('failure');

    renderWithAdminProviders(<AdminDashboardPage />);

    expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    apiMocks.getShopApi.mockRejectedValueOnce(new Error('API client unavailable'));
    await user.click(await screen.findByRole('button', { name: '주문 다시 조회' }));

    expect(
      await screen.findByText('주문 재조회에 실패했습니다. 기존 결과와 경고를 유지합니다.', {
        selector: '[role="status"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '주문 다시 조회' })).toBeEnabled();
    expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(2);
    expect(apiMocks.membersList).toHaveBeenCalledTimes(1);
    expect(apiMocks.listProducts).toHaveBeenCalledTimes(1);
    expect(apiMocks.listQuotes).toHaveBeenCalledTimes(1);
  });

  it('does not write a late Dashboard retry response into a new session cache', async () => {
    const { queryClient, retrySignal } = await startRetryAcrossSessionBoundary(
      <AdminDashboardPage />,
      '주문 다시 조회',
    );

    const cachedDashboard = queryClient.getQueryData<{
      orders: { order: Pick<Order, 'orderNumber'> }[];
      failedOrderMemberIds: string[];
    }>(['admin', 'dashboard']);
    expect(cachedDashboard?.orders.map(({ order }) => order.orderNumber)).toEqual(['ORDER-NEW']);
    expect(cachedDashboard?.failedOrderMemberIds).toEqual([]);
    expect(retrySignal?.aborted).toBe(true);
  });

  it('does not write a late Orders retry response into a new session cache', async () => {
    const { queryClient, retrySignal } = await startRetryAcrossSessionBoundary(
      <AdminOrdersPage />,
      '다시 조회',
    );

    const cachedOrders = queryClient.getQueryData<{
      orders: { orderNumber: string; lines: { productName: string }[] }[];
      failedMemberIds: string[];
    }>(['admin', 'orders', 'list']);
    expect(cachedOrders?.orders.map((order) => order.orderNumber)).toEqual(['ORDER-NEW']);
    expect(cachedOrders?.orders[0]?.lines).toEqual([{ productName: '테스트 상품' }]);
    expect(cachedOrders?.failedMemberIds).toEqual([]);
    expect(retrySignal?.aborted).toBe(true);
  });
});

async function startRetryAcrossSessionBoundary(page: ReactNode, retryButtonName: string) {
  const user = userEvent.setup();
  const delayedMemberBOrders = createDeferred<Order[]>();
  let memberBRequestCount = 0;
  let retrySignal: AbortSignal | undefined;
  apiMocks.membersList.mockResolvedValue([memberA, memberB]);
  apiMocks.listOrdersByMember.mockImplementation(
    (memberId: string, options?: { signal?: AbortSignal }) => {
      if (memberId === memberA.id) {
        return Promise.resolve([createOrder(memberA.id, 'ORDER-A')]);
      }
      if (memberId === memberB.id) {
        memberBRequestCount += 1;
        if (memberBRequestCount === 1) {
          return Promise.reject(new Error('회원 B 주문 API 일시 오류'));
        }
        retrySignal = options?.signal;
        return delayedMemberBOrders.promise;
      }
      return Promise.resolve([]);
    },
  );

  const queryClient = createAdminQueryClient();
  const previousSessionPage = renderWithAdminProviders(page, queryClient);
  expect(await screen.findByRole('link', { name: 'ORDER-A' })).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: retryButtonName }));
  await waitFor(() => expect(apiMocks.listOrdersByMember).toHaveBeenCalledTimes(3));
  expect(retrySignal).toBeDefined();
  expect(retrySignal?.aborted).toBe(false);

  endAdminSession();
  expect(retrySignal?.aborted).toBe(true);
  previousSessionPage.unmount();
  await queryClient.cancelQueries({ queryKey: ['admin'] });
  queryClient.removeQueries({ queryKey: ['admin'] });

  startAdminSession();
  apiMocks.membersList.mockResolvedValue([memberC]);
  apiMocks.listOrdersByMember.mockImplementation((memberId: string) =>
    Promise.resolve([createOrder(memberId, 'ORDER-NEW')]),
  );
  const currentSessionPage = renderWithAdminProviders(page, queryClient);
  expect(await screen.findByRole('link', { name: 'ORDER-NEW' })).toBeInTheDocument();

  delayedMemberBOrders.resolve([createOrder(memberB.id, 'ORDER-LATE')]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  currentSessionPage.unmount();
  return { queryClient, retrySignal };
}
