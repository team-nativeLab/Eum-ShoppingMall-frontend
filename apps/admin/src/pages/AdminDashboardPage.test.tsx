import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDashboardPeriod, AdminDashboardSummary } from '@eum/api/types';
import { AdminDashboardPage } from './AdminDashboardPage';

const dashboardMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  getAdminSummary: vi.fn(),
}));
const apiConfigMock = vi.hoisted(() => ({ mode: 'real' }));

vi.mock('@/lib/shop-api', () => ({
  getShopApi: dashboardMocks.getShopApi,
}));

vi.mock('@/lib/api-config', () => ({
  getAdminApiConfig: () => ({ mode: apiConfigMock.mode }),
}));

const defaultSummary: AdminDashboardSummary = {
  period: 'WEEK',
  from: '2026-11-23T00:00:00.000Z',
  paidOrderCount: 12,
  salesAmount: 345000,
  newMemberCount: 4,
  pendingInquiryCount: 3,
  pendingQuoteCount: 2,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AdminDashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage real API', () => {
  beforeEach(() => {
    dashboardMocks.getShopApi.mockReset();
    dashboardMocks.getAdminSummary.mockReset();
    apiConfigMock.mode = 'real';
    dashboardMocks.getAdminSummary.mockImplementation(
      async (period: AdminDashboardPeriod): Promise<AdminDashboardSummary> => ({
        ...defaultSummary,
        period,
        from: period === 'MONTH' ? '2026-11-01T00:00:00.000Z' : defaultSummary.from,
      }),
    );
    dashboardMocks.getShopApi.mockResolvedValue({
      dashboard: { getAdminSummary: dashboardMocks.getAdminSummary },
    });
  });

  it('shows only the documented server aggregates and excludes the removed quote workflow', async () => {
    renderDashboard();

    const paidOrderTile = await screen.findByRole('link', { name: /결제 완료 주문/ });
    expect(paidOrderTile).toHaveTextContent('12');
    expect(screen.getByRole('link', { name: /매출/ })).toHaveTextContent('345,000');
    expect(screen.getByRole('link', { name: /신규 회원/ })).toHaveTextContent('4');
    expect(screen.getByRole('link', { name: /대기 문의/ })).toHaveTextContent('3');
    expect(screen.queryByText(/견적/)).toBeNull();
    expect(screen.queryByText('일별 주문 건수')).toBeNull();
    expect(
      screen.getByRole('region', {
        name: '운영 지표: 주문·매출·신규 회원 최근 7일, 대기 문의 현재 기준',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /대기 문의/ })).toHaveTextContent('현재 대기');
    expect(screen.getByRole('option', { name: '최근 7일' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '최근 30일' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '오늘' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '조회 기간' })).toHaveValue('WEEK');
    expect(dashboardMocks.getAdminSummary).toHaveBeenCalledWith(
      'WEEK',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reloads the server aggregate when the selected period changes', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByRole('link', { name: /결제 완료 주문/ });
    await user.selectOptions(screen.getByRole('combobox', { name: '조회 기간' }), 'MONTH');

    await waitFor(() => {
      expect(dashboardMocks.getAdminSummary).toHaveBeenCalledWith(
        'MONTH',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(await screen.findByRole('link', { name: /매출.*최근 30일/ })).toHaveTextContent(
      '345,000',
    );
    expect(
      screen.getByRole('region', {
        name: '운영 지표: 주문·매출·신규 회원 최근 30일, 대기 문의 현재 기준',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /대기 문의/ })).toHaveTextContent('현재 대기');
  });

  it('offers a retry action when the protected dashboard request fails', async () => {
    dashboardMocks.getAdminSummary.mockRejectedValueOnce(new Error('Unauthorized'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했습니다');
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeEnabled();
  });
});
