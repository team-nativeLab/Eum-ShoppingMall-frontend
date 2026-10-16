import type { CartItem, CheckoutOptions, Product } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import {
  calculateCheckoutAmounts,
  calculateShippingFee,
  resolveAvailablePaymentMethod,
  resolveCheckoutOptions,
} from './checkout-utils';

const validCheckoutOptions: CheckoutOptions = {
  freeShippingThreshold: 50_000,
  shippingFee: 3000,
  deliveryRequests: [{ id: 'none', label: '요청사항 없음' }],
  shippingMethods: [{ id: 'standard', label: '일반 배송', description: '2~3일' }],
  paymentMethods: [{ id: 'creditCard', label: '신용카드' }],
};

const product: Product = {
  id: 'checkout-test-product',
  name: '테스트 상품',
  brand: '테스트 브랜드',
  categoryId: 'test-category',
  price: 18_000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
  modelName: null,
  images: [],
  options: [],
  specifications: [],
  certifications: [],
  shipping: {
    method: '일반 배송',
    estimate: '2~3일 이내 출고',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '',
  },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-10-16T00:00:00.000Z',
  isFeatured: false,
};

const cartItems: CartItem[] = [
  {
    id: 'checkout-test-line',
    productId: product.id,
    quantity: 1,
    optionId: null,
    optionLabel: null,
    product,
  },
];

describe('checkout option resolution and shipping amounts', () => {
  it.each([
    { name: 'missing', threshold: undefined },
    { name: 'null', threshold: null },
    { name: 'negative', threshold: -1 },
    { name: 'NaN', threshold: Number.NaN },
    { name: 'infinite', threshold: Number.POSITIVE_INFINITY },
  ])('normalizes a $name free shipping threshold to zero', ({ threshold }) => {
    const resolved = resolveCheckoutOptions({
      ...validCheckoutOptions,
      freeShippingThreshold: threshold,
    });

    if (!resolved) throw new Error('Expected required checkout choices to remain valid.');
    expect(resolved.hasFreeShippingThreshold).toBe(false);
    expect(resolved.options.freeShippingThreshold).toBe(0);
    expect(calculateShippingFee(18_000, resolved.options)).toBe(0);

    const amounts = calculateCheckoutAmounts({
      cartItems,
      selectedCartItemIds: ['checkout-test-line'],
      options: resolved.options,
      pointsToUse: 0,
    });
    expect(amounts.shippingFee).toBe(0);
    expect(amounts.paymentTotal).toBe(18_000);
  });

  it('preserves shipping fees for valid thresholds and the existing free shipping boundary', () => {
    expect(calculateShippingFee(18_000, validCheckoutOptions)).toBe(3000);
    expect(calculateShippingFee(50_000, validCheckoutOptions)).toBe(0);
    expect(calculateShippingFee(62_000, validCheckoutOptions)).toBe(0);
    expect(
      calculateShippingFee(18_000, { ...validCheckoutOptions, freeShippingThreshold: 0 }),
    ).toBe(0);
    expect(
      calculateCheckoutAmounts({
        cartItems,
        selectedCartItemIds: ['checkout-test-line'],
        options: validCheckoutOptions,
        pointsToUse: 0,
      }),
    ).toMatchObject({ shippingFee: 3000, paymentTotal: 21_000 });
  });

  it('accepts empty delivery requests when the shipping and payment choices are available', () => {
    expect(
      resolveCheckoutOptions({ ...validCheckoutOptions, deliveryRequests: [] }),
    ).not.toBeNull();
  });

  it('keeps a saved payment method only when it is still offered', () => {
    expect(resolveAvailablePaymentMethod('creditCard', validCheckoutOptions.paymentMethods)).toBe(
      'creditCard',
    );
    expect(
      resolveAvailablePaymentMethod('creditCard', [{ id: 'bankTransfer', label: '계좌 이체' }]),
    ).toBe('bankTransfer');
    expect(resolveAvailablePaymentMethod('creditCard', [])).toBeNull();
  });

  it.each([
    { name: 'null response', response: null },
    { name: 'missing shipping fee', response: { ...validCheckoutOptions, shippingFee: undefined } },
    {
      name: 'missing delivery requests',
      response: { ...validCheckoutOptions, deliveryRequests: undefined },
    },
    {
      name: 'missing shipping methods',
      response: { ...validCheckoutOptions, shippingMethods: undefined },
    },
    { name: 'empty shipping methods', response: { ...validCheckoutOptions, shippingMethods: [] } },
    {
      name: 'missing payment methods',
      response: { ...validCheckoutOptions, paymentMethods: undefined },
    },
    { name: 'empty payment methods', response: { ...validCheckoutOptions, paymentMethods: [] } },
    {
      name: 'malformed payment method',
      response: { ...validCheckoutOptions, paymentMethods: [{ id: 'unknown', label: '결제' }] },
    },
  ])('rejects a $name instead of treating it as free shipping', ({ response }) => {
    expect(resolveCheckoutOptions(response)).toBeNull();
  });

  it.each([
    {
      name: 'delivery request',
      response: {
        ...validCheckoutOptions,
        deliveryRequests: [
          { id: 'none', label: '요청사항 없음' },
          { id: 'none', label: '문 앞에 두세요' },
        ],
      },
    },
    {
      name: 'shipping method',
      response: {
        ...validCheckoutOptions,
        shippingMethods: [
          { id: 'standard', label: '일반 배송', description: '2~3일' },
          { id: 'standard', label: '빠른 배송', description: '1일' },
        ],
      },
    },
    {
      name: 'payment method',
      response: {
        ...validCheckoutOptions,
        paymentMethods: [
          { id: 'creditCard', label: '신용카드' },
          { id: 'creditCard', label: '카드 결제' },
        ],
      },
    },
  ])('rejects duplicate $name IDs', ({ response }) => {
    expect(resolveCheckoutOptions(response)).toBeNull();
  });
});
