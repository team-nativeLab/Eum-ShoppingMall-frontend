import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSuppliersPage } from './AdminSuppliersPage';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  adminList: vi.fn(),
  saveAdmin: vi.fn(),
  deleteAdmin: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSuppliersPage />
    </QueryClientProvider>,
  );
}

describe('Admin 발주 관리', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.adminList.mockResolvedValue([]);
    apiMocks.saveAdmin.mockResolvedValue(undefined);
    apiMocks.deleteAdmin.mockResolvedValue(undefined);
    apiMocks.getShopApi.mockResolvedValue({
      suppliers: {
        adminList: apiMocks.adminList,
        saveAdmin: apiMocks.saveAdmin,
        deleteAdmin: apiMocks.deleteAdmin,
      },
    });
  });

  it('수신 방식을 이메일에서 팩스로 바꾸고 팩스 번호를 저장한다', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: '발주 관리' });
    await user.type(screen.getByLabelText('회사명'), '테스트 회사');
    await user.type(screen.getByLabelText('담당자 이름'), '담당자');
    await user.type(screen.getByLabelText('담당자 전화번호'), '01012345678');
    await user.type(screen.getByLabelText('담당자 이메일'), 'contact@example.com');
    expect(screen.getByLabelText('주문 수신 이메일')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('주문 정보 수신 방식'), 'fax');
    expect(screen.queryByLabelText('주문 수신 이메일')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('주문 수신 팩스 번호'), '0212345678');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: '테스트 회사',
          orderChannel: 'fax',
          orderFax: '0212345678',
        }),
      ),
    );
  });
});
