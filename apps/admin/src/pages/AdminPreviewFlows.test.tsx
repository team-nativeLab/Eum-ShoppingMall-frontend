import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AdminMemberDetailPage } from './AdminMemberDetailPage';
import { AdminOrderDetailPage } from './AdminOrderDetailPage';
import { AdminCouponsPage } from './AdminCouponsPage';
import { AdminQuotesPage } from './AdminQuotesPage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminWithdrawnMemberDetailPage } from './AdminWithdrawnMemberDetailPage';

const shopMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  membersList: vi.fn(),
  ordersList: vi.fn(),
  quotesList: vi.fn(),
  orderGet: vi.fn(),
  claimsList: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: shopMocks.getShopApi }));

function renderSettings() {
  const router = createMemoryRouter([
    { path: '/', element: <AdminSettingsPage /> },
    { path: '/next', element: <p>다음 화면</p> },
  ]);
  return { router, ...render(<RouterProvider router={router} />) };
}

describe('Admin demo preview flows', () => {
  it('shows a navigation warning only while settings differ from the current preview', async () => {
    const user = userEvent.setup();
    const { router } = renderSettings();
    await user.clear(screen.getByLabelText('기본 배송비(원)'));
    await user.type(screen.getByLabelText('기본 배송비(원)'), '4000');
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
    await user.clear(screen.getByLabelText('기본 배송비(원)'));
    await user.type(screen.getByLabelText('기본 배송비(원)'), '-1');
    expect(screen.getByRole('button', { name: '저장 미리보기' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('0 이상 숫자로 입력해 주세요');
  });

  it('validates coupon registration and keeps a successful registration in the demo list only', async () => {
    const user = userEvent.setup();
    render(<AdminCouponsPage />);
    await user.click(screen.getByRole('button', { name: '쿠폰 등록' }));
    await user.click(screen.getByRole('button', { name: '등록 미리보기' }));
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
    await user.click(screen.getByRole('button', { name: '등록 미리보기' }));
    expect(await screen.findByText('화면 전용 쿠폰')).toBeInTheDocument();
    expect(screen.getByText('이 화면 전용 안내')).toBeInTheDocument();
    expect(screen.getByText('최대 할인 2,000원')).toBeInTheDocument();
    expect(screen.getByText('최소 주문 15,000원')).toBeInTheDocument();
    expect(screen.getAllByText('다운로드').length).toBeGreaterThan(0);
    expect(screen.getByText('개인 · 상품 선택')).toBeInTheDocument();
    expect(screen.getByText('제한 42')).toBeInTheDocument();
    expect(screen.getAllByText('중복 가능').length).toBeGreaterThan(0);
    expect(screen.getByText(/실제 발급·할인 계산에는 반영되지 않았습니다/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears the quote PDF input on cancel and allows choosing the same file again', async () => {
    const user = userEvent.setup();
    shopMocks.quotesList.mockResolvedValue([
      {
        id: 'quote-a',
        title: '견적 문의',
        companyName: '이음 회사',
        contactName: '담당자',
        status: 'received',
        requestedAt: '2026-10-15T00:00:00Z',
        memberId: null,
      },
    ]);
    shopMocks.getShopApi.mockResolvedValue({ quotes: { list: shopMocks.quotesList } });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AdminQuotesPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '견적 문의' }));
    await user.click(screen.getByRole('button', { name: '견적서 발송' }));
    const fileInput = screen.getByLabelText('견적서 파일 (PDF 1개)') as HTMLInputElement;
    const pdf = new File(['quote'], 'quote.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdf] } });
    expect(screen.getByText(/quote\.pdf/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(fileInput.value).toBe('');
    expect(screen.queryByText(/quote\.pdf/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '견적서 발송' }));
    fireEvent.change(fileInput, { target: { files: [pdf] } });
    expect(screen.getByText(/quote\.pdf/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('견적 금액'), '1000');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const expiryDate = [
      futureDate.getFullYear(),
      String(futureDate.getMonth() + 1).padStart(2, '0'),
      String(futureDate.getDate()).padStart(2, '0'),
    ].join('-');
    fireEvent.change(screen.getByLabelText('유효기간'), { target: { value: expiryDate } });
    const quoteNoticeInput = screen.getByText('고객 안내').parentElement?.querySelector('textarea');
    if (!quoteNoticeInput) throw new Error('견적 고객 안내 입력을 찾을 수 없습니다.');
    fireEvent.change(quoteNoticeInput, { target: { value: '견적 내용을 확인해 주세요.' } });
    await user.click(screen.getByRole('button', { name: '발송 미리보기' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '견적 발송 미리보기를 완료했습니다.',
    );
    expect(fileInput.value).toBe('');
    expect(screen.queryByText(/quote\.pdf/)).not.toBeInTheDocument();
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
    shopMocks.quotesList.mockResolvedValue([]);
    shopMocks.getShopApi.mockResolvedValue({
      members: { list: shopMocks.membersList },
      orders: { listByMember: shopMocks.ordersList },
      quotes: { list: shopMocks.quotesList },
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

  it('renders only masked synthetic purchase, quote, and memo records on withdrawn details', () => {
    const router = createMemoryRouter(
      [{ path: '/members/withdrawn/:memberId', element: <AdminWithdrawnMemberDetailPage /> }],
      { initialEntries: ['/members/withdrawn/admin-demo-withdrawn-001'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByText('010-****-0001')).toBeInTheDocument();
    expect(screen.getByText('ex*****@email.com')).toBeInTheDocument();
    expect(screen.getByText('주문 이력 (2)')).toBeInTheDocument();
    expect(screen.getByText('견적 문의 이력 (1)')).toBeInTheDocument();
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
      members: { list: shopMocks.membersList },
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
    await user.click(await screen.findByRole('button', { name: '취소 요청 확인 미리보기' }));
    await user.selectOptions(screen.getByLabelText('확인 사유'), '요청 내용 확인');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(screen.getByRole('button', { name: '취소 요청 확인 미리보기' }));
    expect(screen.getByLabelText('확인 사유')).toHaveValue('');
  });
});
