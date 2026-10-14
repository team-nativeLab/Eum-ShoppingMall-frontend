import type { Coupon, OrderLine, OrderStatus, QuoteStatus } from '@eum/api/types';

export type MyPageApiMode = 'mock' | 'real';

/** API mode alone determines whether presentation-only layout rows may appear. */
export function shouldShowPresentationRows(mode: MyPageApiMode) {
  return mode === 'mock';
}

/** Maps the available order status to the closest step in the tracking display. */
export function getTrackingProgressIndex(status: OrderStatus) {
  const indexByStatus: Record<OrderStatus, number> = {
    paymentPending: -1,
    paid: 0,
    preparing: 1,
    shipping: 3,
    delivered: 4,
    canceled: -1,
  };

  return indexByStatus[status];
}

/** Keeps return quantities within the selected order line's available quantity. */
export function clampReturnQuantity(quantity: number, orderQuantity: number) {
  const maximum = Math.max(1, Math.trunc(orderQuantity));
  return Math.min(maximum, Math.max(1, Math.trunc(quantity)));
}

/** Sums selected fixture order lines using their requested return quantity when provided. */
export function calculateSelectedOrderAmount(
  lines: readonly OrderLine[],
  selectedLineIds: readonly string[],
  quantities: Readonly<Record<string, number>> = {},
) {
  return lines.reduce((total, line, index) => {
    const lineId = `${line.productId}-${index}`;
    if (!selectedLineIds.includes(lineId)) return total;
    const quantity = clampReturnQuantity(quantities[lineId] ?? line.quantity, line.quantity);
    return total + line.unitPrice * quantity;
  }, 0);
}

/** An invalid requested order stays unselected until the shopper chooses another one. */
export function getInitialClaimOrderId(
  eligibleOrderIds: readonly string[],
  preferredOrderId?: string,
) {
  if (preferredOrderId !== undefined) {
    return eligibleOrderIds.includes(preferredOrderId) ? preferredOrderId : '';
  }
  return eligibleOrderIds[0] ?? '';
}

/** Cancelled quotes have no admin progress events to map onto the active quote steps. */
export function shouldShowQuoteProgress(status: QuoteStatus) {
  return status !== 'canceled';
}

/** Subtracts calendar months while keeping end-of-month dates within the target month. */
export function subtractMonthsClamped(date: Date, months: number) {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(date.getDate(), lastDay));
  return targetMonth;
}

/** Compares coupon expiry by calendar date so dashboard and coupon list use the same rule. */
export function isCouponExpired(
  coupon: Pick<Coupon, 'expiresAt'>,
  today = dateInputValue(new Date()),
) {
  return coupon.expiresAt.slice(0, 10) < today;
}

export function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
