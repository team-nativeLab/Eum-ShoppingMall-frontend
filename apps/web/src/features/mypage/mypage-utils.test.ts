import { describe, expect, it } from 'vitest';
import {
  calculateSelectedOrderAmount,
  clampReturnQuantity,
  dateInputValue,
  getInitialClaimOrderId,
  getTrackingProgressIndex,
  isCouponExpired,
  shouldShowQuoteProgress,
  shouldShowPresentationRows,
  subtractMonthsClamped,
} from './mypage-utils';

describe('mypage presentation and date helpers', () => {
  it('shows presentation rows only in mock API mode', () => {
    expect(shouldShowPresentationRows('mock')).toBe(true);
    expect(shouldShowPresentationRows('real')).toBe(false);
  });

  it('maps tracking steps from the selected order status', () => {
    expect(getTrackingProgressIndex('paid')).toBe(0);
    expect(getTrackingProgressIndex('preparing')).toBe(1);
    expect(getTrackingProgressIndex('shipping')).toBe(3);
    expect(getTrackingProgressIndex('delivered')).toBe(4);
  });

  it('clamps return quantities and calculates selected order line amounts', () => {
    expect(clampReturnQuantity(0, 5)).toBe(1);
    expect(clampReturnQuantity(3, 2)).toBe(2);
    expect(clampReturnQuantity(2.8, 4)).toBe(2);

    const lines = [
      { productId: 'helmet', productName: '안전모', unitPrice: 18000, quantity: 5 },
      { productId: 'gloves', productName: '장갑', unitPrice: 12000, quantity: 2 },
    ];
    expect(
      calculateSelectedOrderAmount(lines, ['helmet-0', 'gloves-1'], {
        'helmet-0': 2,
        'gloves-1': 1,
      }),
    ).toBe(48000);
  });

  it('does not silently replace an unavailable requested claim order', () => {
    const eligibleOrderIds = ['ord-001', 'ord-002'];

    expect(getInitialClaimOrderId(eligibleOrderIds, 'ord-002')).toBe('ord-002');
    expect(getInitialClaimOrderId(eligibleOrderIds, 'ord-missing')).toBe('');
    expect(getInitialClaimOrderId(eligibleOrderIds)).toBe('ord-001');
  });

  it('hides the active quote progress timeline for cancelled quotes', () => {
    expect(shouldShowQuoteProgress('canceled')).toBe(false);
    expect(shouldShowQuoteProgress('completed')).toBe(true);
  });

  it('clamps month subtraction to the last valid target day', () => {
    expect(dateInputValue(subtractMonthsClamped(new Date(2026, 2, 31), 1))).toBe('2026-02-28');
    expect(dateInputValue(subtractMonthsClamped(new Date(2024, 2, 31), 1))).toBe('2024-02-29');
  });

  it('treats a coupon expiring today as valid through the calendar day', () => {
    const coupon = { expiresAt: '2026-10-14T00:00:00.000Z' };

    expect(isCouponExpired(coupon, '2026-10-14')).toBe(false);
    expect(isCouponExpired(coupon, '2026-10-15')).toBe(true);
  });
});
