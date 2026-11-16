import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminCoupon } from '@eum/api/types';
import { AdminCouponsPage } from './AdminCouponsPage';

const mocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: mocks.getShopApi }));

function renderCouponsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminCouponsPage />
    </QueryClientProvider>,
  );
}

function createCoupon(index: number): AdminCoupon {
  return {
    id: `coupon-${index}`,
    name: `쿠폰 ${index}`,
    code: `CODE${index}`,
    benefitType: 'rate',
    benefitValue: 10,
    maxDiscountAmount: 5000,
    minimumOrderAmount: 10000,
    target: 'all',
    issueMethod: 'automatic',
    productScope: 'all',
    issueLimit: 100,
    allowStacking: false,
    validityMode: 'period',
    validityDays: null,
    startsAt: `2026-10-${String(index).padStart(2, '0')}`,
    endsAt: '2026-12-31',
    issuedCount: 0,
    usedCount: 0,
    status: 'active',
    notice: '',
  };
}

describe('Admin coupon pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clamps the displayed page when a status update shrinks the filtered results', async () => {
    const user = userEvent.setup();
    const coupons = Array.from({ length: 11 }, (_, index) => createCoupon(index + 1));
    const adminList = vi.fn(async () => [...coupons]);
    const saveAdmin = vi.fn(async (input: AdminCoupon) => {
      const couponIndex = coupons.findIndex((coupon) => coupon.id === input.id);
      coupons[couponIndex] = input;
      return input;
    });
    mocks.getShopApi.mockResolvedValue({ coupons: { adminList, saveAdmin } });
    renderCouponsPage();

    await user.click(await screen.findByRole('button', { name: /사용 중\s*11/ }));
    await user.click(screen.getByRole('button', { name: '2페이지' }));
    const lastCouponRow = screen.getByRole('row', { name: /쿠폰 1/ });
    await user.selectOptions(
      within(lastCouponRow).getByRole('combobox', { name: '쿠폰 1 상태' }),
      'ended',
    );

    await waitFor(() => expect(adminList).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('row', { name: /쿠폰 11/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2페이지' })).not.toBeInTheDocument();
  });
});
