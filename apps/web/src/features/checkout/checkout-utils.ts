import { calculateCartTotals } from '@eum/api/cart';
import type { CartItem, CheckoutOptions, Coupon, PaymentMethod } from '@eum/api/types';

const SUPPORTED_PAYMENT_METHODS = {
  creditCard: true,
  bankTransfer: true,
  virtualAccount: true,
  simpleA: true,
  simpleB: true,
  mobile: true,
} satisfies Record<PaymentMethod, true>;

export interface ResolvedCheckoutOptions {
  options: CheckoutOptions;
  hasFreeShippingThreshold: boolean;
}

export interface CheckoutAmounts {
  productTotal: number;
  discountTotal: number;
  shippingFee: number;
  pointsUsed: number;
  paymentTotal: number;
}

/** Validates required checkout choices and treats only a missing/invalid threshold as zero. */
export function resolveCheckoutOptions(response: unknown): ResolvedCheckoutOptions | null {
  if (!isRecord(response) || !isFiniteNonNegativeNumber(response.shippingFee)) return null;

  const deliveryRequests = parseDeliveryRequests(response.deliveryRequests);
  const shippingMethods = parseShippingMethods(response.shippingMethods);
  const paymentMethods = parsePaymentMethods(response.paymentMethods);
  if (!deliveryRequests || !shippingMethods?.length || !paymentMethods?.length) {
    return null;
  }

  const hasFreeShippingThreshold = isFiniteNonNegativeNumber(response.freeShippingThreshold);
  let freeShippingThreshold = 0;
  if (isFiniteNonNegativeNumber(response.freeShippingThreshold)) {
    freeShippingThreshold = response.freeShippingThreshold;
  }

  return {
    options: {
      freeShippingThreshold,
      shippingFee: response.shippingFee,
      deliveryRequests,
      shippingMethods,
      paymentMethods,
    },
    hasFreeShippingThreshold,
  };
}

/** Shares the shipping rule across cart, shipping, and payment summaries. */
export function calculateShippingFee(productTotal: number, options: CheckoutOptions): number {
  const threshold = isFiniteNonNegativeNumber(options.freeShippingThreshold)
    ? options.freeShippingThreshold
    : 0;
  return productTotal === 0 || productTotal >= threshold ? 0 : options.shippingFee;
}

/** Keeps a saved payment method only if it is still offered, otherwise selects the first option. */
export function resolveAvailablePaymentMethod(
  currentPaymentMethod: PaymentMethod,
  availablePaymentMethods: CheckoutOptions['paymentMethods'],
): PaymentMethod | null {
  if (availablePaymentMethods.some(({ id }) => id === currentPaymentMethod)) {
    return currentPaymentMethod;
  }
  return availablePaymentMethods[0]?.id ?? null;
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
  const shippingFee = calculateShippingFee(productTotal, options);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseDeliveryRequests(value: unknown): CheckoutOptions['deliveryRequests'] | null {
  if (!Array.isArray(value)) return null;
  const deliveryRequests: CheckoutOptions['deliveryRequests'] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.label)) {
      return null;
    }
    if (ids.has(entry.id)) return null;
    ids.add(entry.id);
    deliveryRequests.push({ id: entry.id, label: entry.label });
  }
  return deliveryRequests;
}

function parseShippingMethods(value: unknown): CheckoutOptions['shippingMethods'] | null {
  if (!Array.isArray(value)) return null;
  const shippingMethods: CheckoutOptions['shippingMethods'] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !isNonEmptyString(entry.id) ||
      !isNonEmptyString(entry.label) ||
      !isNonEmptyString(entry.description)
    ) {
      return null;
    }
    if (ids.has(entry.id)) return null;
    ids.add(entry.id);
    shippingMethods.push({ id: entry.id, label: entry.label, description: entry.description });
  }
  return shippingMethods;
}

function parsePaymentMethods(value: unknown): CheckoutOptions['paymentMethods'] | null {
  if (!Array.isArray(value)) return null;
  const paymentMethods: CheckoutOptions['paymentMethods'] = [];
  const ids = new Set<PaymentMethod>();
  for (const entry of value) {
    if (!isRecord(entry) || !isPaymentMethod(entry.id) || !isNonEmptyString(entry.label)) {
      return null;
    }
    if (ids.has(entry.id)) return null;
    ids.add(entry.id);
    paymentMethods.push({ id: entry.id, label: entry.label });
  }
  return paymentMethods;
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SUPPORTED_PAYMENT_METHODS, value)
  );
}
