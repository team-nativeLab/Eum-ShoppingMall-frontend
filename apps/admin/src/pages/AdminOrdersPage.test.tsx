import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AdminOrder } from '@eum/api/types';
import { AdminOrdersPage } from './AdminOrdersPage';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listMembers: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
vi.mock('@/lib/api-config', () => ({ getAdminApiConfig: () => ({ mode: 'mock' }) }));

const member = {
  id: 'member-1',
  name: '테스트 회원',
  email: 'member@example.com',
  phone: '010-0000-0000',
  joinedAt: '2026-01-01T00:00:00.000Z',
  pointBalance: 0,
};

const order = {
  id: 'order-1',
  orderNumber: 'ORDER-2026-001',
  orderedAt: '2026-10-14T12:00:00.000Z',
  status: 'paid',
  memberId: member.id,
  lines: [{ productId: 'product-1', productName: '테스트 상품', unitPrice: 1000, quantity: 1 }],
  productTotal: 1000,
  shippingFee: 0,
  discountTotal: 0,
  pointUsed: 0,
  paymentTotal: 1000,
  shippingAddress: {
    id: 'address-1',
    label: '기본 배송지',
    recipientName: '테스트 수령인',
    phone: '010-0000-0001',
    postalCode: '00000',
    address1: '서울시 테스트구',
    address2: '',
    isDefault: true,
  },
  trackingCarrier: null,
  trackingNumber: null,
  adminMemo: '',
  statusHistory: [],
} satisfies AdminOrder;

function OrderDetailRoute() {
  const { orderId } = useParams();
  return <h1>주문 상세: {orderId}</h1>;
}

describe('AdminOrdersPage row actions', () => {
  it('exposes a labeled disclosure and navigates by keyboard without clearing selection', async () => {
    const user = userEvent.setup();
    apiMocks.listMembers.mockResolvedValue([member]);
    apiMocks.listOrders.mockResolvedValue([order]);
    apiMocks.getShopApi.mockResolvedValue({
      members: { adminList: apiMocks.listMembers },
      orders: { adminList: apiMocks.listOrders },
    });

    const router = createMemoryRouter(
      [
        { path: '/orders', element: <AdminOrdersPage /> },
        { path: '/orders/:orderId', element: <OrderDetailRoute /> },
      ],
      { initialEntries: ['/orders'] },
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const checkbox = await screen.findByRole('checkbox', { name: 'ORDER-2026-001 선택' });
    await user.click(checkbox);
    expect(screen.getByText('선택 1건')).toBeInTheDocument();

    const menuToggle = screen.getByLabelText('ORDER-2026-001 작업');
    menuToggle.focus();
    expect(menuToggle).toHaveFocus();
    await user.click(menuToggle);

    expect(menuToggle.closest('details')).toHaveAttribute('open');
    expect(screen.getByText('선택 1건')).toBeInTheDocument();
    const detailLink = screen.getByRole('link', { name: '주문 상세 보기' });
    await user.tab();
    expect(detailLink).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: '주문 상세: order-1' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/order-1'));
  });
});
