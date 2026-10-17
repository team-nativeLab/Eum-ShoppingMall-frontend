import { ApiError } from '@eum/api/errors';
import type { ShopApi } from '@eum/api/shop-api';
import type { Claim, Order } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopApi } from '@/lib/shop-api';
import { ClaimDetailPage } from './claim-detail-page';

const apiMocks = vi.hoisted(() => ({
  claimsList: vi.fn(),
  ordersList: vi.fn(),
  membersList: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: vi.fn() }));
vi.mock('@/features/auth/member-session', () => ({
  useMemberSession: () => ({ member: { id: 'member-a' }, status: 'ready', refreshMember: vi.fn() }),
}));
vi.mock('./mypage-shell', () => ({
  MyPageShell: ({
    children,
    title,
    titleDescription,
    titleAction,
  }: {
    children: ReactNode;
    title: string;
    titleDescription?: ReactNode;
    titleAction?: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {titleDescription ? <p>{titleDescription}</p> : null}
      {titleAction}
      {children}
    </main>
  ),
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const claim: Claim = {
  id: 'claim-a',
  orderId: 'order-a',
  type: 'return',
  status: 'processing',
  reason: '사이즈 변경',
  requestedAt: '2026-10-01T00:00:00+09:00',
};
const order: Order = {
  id: 'order-a',
  orderNumber: '202610010001',
  orderedAt: '2026-10-01T00:00:00+09:00',
  status: 'delivered',
  memberId: 'member-a',
  lines: [{ productId: 'product-a', productName: '안전화', unitPrice: 10000, quantity: 1 }],
  productTotal: 10000,
  shippingFee: 0,
  discountTotal: 0,
  pointUsed: 0,
  paymentTotal: 10000,
  shippingAddress: {
    id: 'address-a',
    label: '기본',
    recipientName: '회원',
    phone: '01000000000',
    postalCode: '00000',
    address1: '서울',
    address2: '',
    isDefault: true,
  },
};

function renderDetail(claimId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClaimDetailPage claimId={claimId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.claimsList.mockResolvedValue([claim]);
  apiMocks.ordersList.mockResolvedValue([order]);
  apiMocks.membersList.mockResolvedValue([]);
  vi.mocked(getShopApi).mockResolvedValue({
    claims: { listByMember: apiMocks.claimsList },
    orders: { listByMember: apiMocks.ordersList },
    members: { list: apiMocks.membersList },
  } as unknown as ShopApi);
});

describe('회원 클레임 상세', () => {
  it('직접 진입 시 현재 회원의 목록에서 상세를 찾고 회원 ID로만 요청합니다', async () => {
    renderDetail('claim-a');
    expect(await screen.findByRole('heading', { name: '신청 상세' })).toBeInTheDocument();
    expect(await screen.findByText('claim-a')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getAllByText(
        '접수하신 취소·반품·교환 신청의 진행 상황과 신청 내용을 확인할 수 있습니다.',
      ),
    ).toHaveLength(1);
    expect(screen.getByText('주문번호 202610010001')).toBeInTheDocument();
    expect(screen.getByText('사이즈 변경')).toBeInTheDocument();
    expect(screen.getByText('서울')).toBeInTheDocument();
    const timeline = screen.getByRole('list', { name: '신청 진행 상태' });
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(4);
    expect(within(timeline).getByText('상품 회수').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    const processingBadge = screen.getByText('처리 중');
    expect(processingBadge).toHaveClass('rounded-capsule', 'bg-[#f3f8f6]', 'text-[#0a6e57]');
    expect(screen.getByText('반품 상품 회수를 진행하고 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '회수 및 교환 정보' })).toBeInTheDocument();
    expect(screen.getByText('정보 미제공')).toBeInTheDocument();
    expect(apiMocks.claimsList).toHaveBeenCalledWith(
      'member-a',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiMocks.ordersList).toHaveBeenCalledWith(
      'member-a',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiMocks.membersList).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: '취소·반품 내역으로' })).toHaveAttribute(
      'href',
      '/mypage/claims',
    );
    expect(screen.getByText(/신청 정보가 다르거나 추가 문의가 필요하면/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1:1 문의' })).toHaveAttribute(
      'href',
      '/mypage/inquiries',
    );
  });

  it('주문 조회가 실패하면 누락과 구분하고 신청 정보는 유지하며 재시도할 수 있습니다', async () => {
    apiMocks.ordersList
      .mockRejectedValueOnce(new ApiError('NETWORK', 'order list unavailable'))
      .mockResolvedValueOnce([order]);
    renderDetail('claim-a');

    expect(await screen.findByText('claim-a')).toBeInTheDocument();
    expect(screen.getByText('사이즈 변경')).toBeInTheDocument();
    const claimApplication = screen.getByRole('region', { name: '신청 내용' });
    expect(within(claimApplication).getByText(/조회 실패/)).toHaveTextContent('주문번호 조회 실패');
    expect(screen.getByText('주문 정보를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('주문 상품 정보를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(
      screen.getByText('주문 조회 실패로 회수 주소를 확인할 수 없습니다.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('주문번호 202610010001')).toBeInTheDocument();
    expect(screen.getByText('서울')).toBeInTheDocument();
    expect(apiMocks.ordersList).toHaveBeenCalledTimes(2);
  });

  it('주문 API가 구현되지 않았으면 준비 안내만 표시하고 재시도를 숨깁니다', async () => {
    apiMocks.ordersList.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'not connected'));
    renderDetail('claim-a');

    expect(await screen.findByText('claim-a')).toBeInTheDocument();
    expect(screen.getByText('사이즈 변경')).toBeInTheDocument();
    expect(screen.getByText('주문 정보를 준비하고 있습니다.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '신청 내용' })).getByText(/준비 중/),
    ).toHaveTextContent('주문번호 준비 중');
    expect(screen.getByText('주문 상품 정보를 준비하고 있습니다.')).toBeInTheDocument();
    expect(screen.getByText('주문 배송 정보를 준비하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(screen.queryByText('주문 정보를 불러오지 못했습니다.')).not.toBeInTheDocument();
  });

  it('주문 조회는 성공했지만 연결된 주문이 없으면 정보 미제공 상태를 표시합니다', async () => {
    apiMocks.ordersList.mockResolvedValue([]);
    renderDetail('claim-a');

    const claimApplication = await screen.findByRole('region', { name: '신청 내용' });
    expect(within(claimApplication).getByText(/정보 미제공/)).toHaveTextContent(
      '주문번호 정보 미제공',
    );
    expect(screen.getByText('주문 상품 정보를 제공하지 않습니다.')).toBeInTheDocument();
    expect(screen.getByText('주문 배송지 정보 미제공')).toBeInTheDocument();
    expect(screen.queryByText('주문 정보를 불러오지 못했습니다.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('신청 데이터의 선택 설명이 있을 때 사유 아래에 표시합니다', async () => {
    apiMocks.claimsList.mockResolvedValue([
      { ...claim, description: '착용 전 사이즈 확인 중 교환을 요청했습니다.' },
    ]);
    renderDetail('claim-a');

    expect(
      await screen.findByText('착용 전 사이즈 확인 중 교환을 요청했습니다.'),
    ).toBeInTheDocument();
  });

  it('없는 ID와 다른 회원에 속한 ID에는 같은 not-found 화면을 표시합니다', async () => {
    apiMocks.claimsList.mockResolvedValue([]);
    renderDetail('claim-from-another-member');
    expect(
      await screen.findByRole('heading', { name: '신청 내역을 찾을 수 없습니다.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('claim-from-another-member')).not.toBeInTheDocument();
  });

  it('real API의 NOT_IMPLEMENTED 오류는 누락된 상세와 구분합니다', async () => {
    apiMocks.claimsList.mockRejectedValue(new ApiError('NOT_IMPLEMENTED', 'not connected'));
    renderDetail('claim-a');
    expect(await screen.findByText('신청 상세 기능을 준비하고 있습니다.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '신청 내역을 찾을 수 없습니다.' }),
    ).not.toBeInTheDocument();
  });

  it('반려된 클레임은 완료 단계 진행 표시 대신 별도 종료 상태를 표시합니다', async () => {
    apiMocks.claimsList.mockResolvedValue([{ ...claim, status: 'rejected' }]);
    renderDetail('claim-a');

    expect(await screen.findByText('신청이 반려되었습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '신청 진행 상태' })).not.toBeInTheDocument();
  });

  it.each([
    {
      type: 'cancel',
      badgeLabel: '처리 중',
      activeStep: '결제 취소',
      waitingStep: '환불 완료',
      description: '결제 취소를 진행하고 있습니다.',
    },
    {
      type: 'return',
      badgeLabel: '처리 중',
      activeStep: '상품 회수',
      waitingStep: '상품 검수',
      description: '반품 상품 회수를 진행하고 있습니다.',
    },
    {
      type: 'exchange',
      badgeLabel: '교환 · 검수 중',
      activeStep: '상품 검수',
      waitingStep: '교환 상품 발송',
      description: '회수된 상품을 검수하고 있습니다.',
    },
  ] as const)('$type 처리 중 상태는 실제 활성 단계와 설명을 표시합니다', async (expected) => {
    apiMocks.claimsList.mockResolvedValue([
      { ...claim, type: expected.type, status: 'processing' },
    ]);
    renderDetail('claim-a');

    expect(await screen.findByText(expected.badgeLabel)).toBeInTheDocument();
    const timeline = screen.getByRole('list', { name: '신청 진행 상태' });
    const activeStep = within(timeline).getByText(expected.activeStep).closest('li');
    expect(activeStep).toHaveAttribute('aria-current', 'step');
    expect(within(activeStep as HTMLElement).getByText(expected.description)).toBeInTheDocument();
    const activeMarker = activeStep?.querySelector('[aria-hidden="true"]');
    expect(activeMarker).toHaveClass('border-success', 'bg-bg');
    expect(activeMarker).not.toHaveClass('bg-success');
    const waitingStep = within(timeline).getByText(expected.waitingStep).closest('li');
    const waitingMarker = waitingStep?.querySelector('[aria-hidden="true"]');
    expect(waitingMarker).toHaveClass('border-line-strong', 'bg-bg');
    const completedStep = within(timeline).getByText('신청 접수').closest('li');
    const completedMarker = completedStep?.querySelector('[aria-hidden="true"]');
    expect(completedMarker).toHaveClass('border-success', 'bg-success');
  });
});
