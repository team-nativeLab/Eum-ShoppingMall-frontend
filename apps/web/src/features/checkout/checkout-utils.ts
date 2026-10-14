import { calculateCartTotals } from '@eum/api/cart';
import type { CartItem, CheckoutOptions, Coupon } from '@eum/api/types';

export interface CheckoutAmounts {
  productTotal: number;
  discountTotal: number;
  shippingFee: number;
  pointsUsed: number;
  paymentTotal: number;
}

export function calculateCheckoutAmounts({
  cartItems,
  selectedCartItemIds,
  options,
  coupon,
  pointsToUse,
}: {
  cartItems: readonly CartItem[];
  selectedCartItemIds: readonly string[];
  options: CheckoutOptions;
  coupon?: Coupon;
  pointsToUse: number;
}): CheckoutAmounts {
  const productTotal = calculateCartTotals(cartItems, new Set(selectedCartItemIds)).productTotal;
  const isCouponEligible = coupon && !coupon.isUsed && productTotal >= coupon.minOrderAmount;
  const rawDiscount = isCouponEligible
    ? coupon.discountType === 'amount'
      ? coupon.discountValue
      : Math.floor((productTotal * coupon.discountValue) / 100)
    : 0;
  const discountTotal = Math.min(productTotal, rawDiscount);
  const beforePoints = productTotal - discountTotal;
  const pointsUsed = Math.min(Math.max(0, Math.floor(pointsToUse)), beforePoints);
  const shippingFee =
    productTotal === 0 || productTotal >= options.freeShippingThreshold ? 0 : options.shippingFee;

  return {
    productTotal,
    discountTotal,
    shippingFee,
    pointsUsed,
    paymentTotal: Math.max(0, beforePoints - pointsUsed + shippingFee),
  };
}

export function getCouponDiscount(coupon: Coupon, productTotal: number): number {
  if (coupon.isUsed || productTotal < coupon.minOrderAmount) return 0;
  const discount =
    coupon.discountType === 'amount'
      ? coupon.discountValue
      : Math.floor((productTotal * coupon.discountValue) / 100);
  return Math.min(productTotal, discount);
}
