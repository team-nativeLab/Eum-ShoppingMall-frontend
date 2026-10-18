import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminClaim } from '@eum/api/types';
import { AdminClaimsPage } from './AdminClaimsPage';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  adminList: vi.fn(),
  updateAdmin: vi.fn(),
  completeOrderCancellation: vi.fn(),
}));
vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

const claim: AdminClaim = {
  id: 'claim-1',
  orderId: 'order-1',
  type: 'return',
  status: 'requested',
  reason: '상품 파손',
  description: '포장 개봉 후 파손 확인',
  requestedAt: '2026-10-10T12:00:00.000Z',
  items: [{ productId: 'prd-1001', skuId: 'sku-white', optionLabel: '색상: 백색', quantity: 2 }],
  returnMethod: 'pickup',
  returnAddress: {
    recipientName: '목 회원',
    phone: '010-0000-0000',
    postalCode: '00000',
    address1: '서울시',
    address2: '마포구',
  },
  attachments: [{ fileName: 'damage.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 }],
  adminMemo: '',
  statusHistory: [{ status: 'requested', occurredAt: '2026-10-10T12:00:00.000Z', note: '' }],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminClaimsPage />
    </QueryClientProvider>,
  );
}

describe('AdminClaimsPage', () => {
  it('shows requested claim details and saves status plus internal memo through ShopApi', async () => {
    const user = userEvent.setup();
    apiMocks.adminList.mockResolvedValue([claim]);
    apiMocks.updateAdmin.mockResolvedValue({
      ...claim,
      status: 'processing',
      adminMemo: '회수 확인 중',
    });
    apiMocks.getShopApi.mockResolvedValue({
      claims: { adminList: apiMocks.adminList, updateAdmin: apiMocks.updateAdmin },
    });
    renderPage();

    expect(await screen.findByText('포장 개봉 후 파손 확인')).toBeInTheDocument();
    expect(screen.getAllByText(/sku-white.*옵션 색상: 백색.*2개/).length).toBeGreaterThan(0);
    expect(screen.getByText('택배 회수 신청')).toBeInTheDocument();
    expect(screen.getByText(/목 회원.*010-0000-0000/)).toBeInTheDocument();
    expect(screen.getByText(/damage.jpg.*image\/jpeg.*2 KB/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('처리 상태'), 'processing');
    fireEvent.change(screen.getByLabelText('내부 처리 메모'), {
      target: { value: '회수 확인 중' },
    });
    await user.click(screen.getByRole('button', { name: '처리 내용 저장' }));

    expect(apiMocks.updateAdmin).toHaveBeenCalledWith('claim-1', {
      status: 'processing',
      adminMemo: '회수 확인 중',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('목 API에 저장했습니다');
  });

  it('requires a reason and uses the atomic cancellation operation instead of generic completion', async () => {
    const user = userEvent.setup();
    const cancelClaim: AdminClaim = {
      ...claim,
      type: 'cancel',
      status: 'requested',
      reason: '주문 취소 요청',
    };
    apiMocks.adminList.mockResolvedValue([cancelClaim]);
    apiMocks.completeOrderCancellation.mockResolvedValue({
      order: {},
      claim: { ...cancelClaim, status: 'completed' },
    });
    apiMocks.getShopApi.mockResolvedValue({
      claims: {
        adminList: apiMocks.adminList,
        updateAdmin: apiMocks.updateAdmin,
        completeOrderCancellation: apiMocks.completeOrderCancellation,
      },
    });
    renderPage();

    expect((await screen.findAllByText('주문 취소 요청')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('option', { name: '완료' })).not.toBeInTheDocument();
    const completeButton = screen.getByRole('button', { name: '주문 취소 및 복원 처리' });
    expect(completeButton).toBeDisabled();
    await user.type(screen.getByLabelText('취소 처리 사유'), '고객 요청으로 취소');
    expect(completeButton).toBeEnabled();
    await user.click(completeButton);

    expect(apiMocks.completeOrderCancellation).toHaveBeenCalledWith(
      'order-1',
      'claim-1',
      '고객 요청으로 취소',
    );
    expect(apiMocks.updateAdmin).not.toHaveBeenCalledWith(
      'claim-1',
      expect.objectContaining({ status: 'completed' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('실제 환불은 실행되지 않습니다');
  });
});
