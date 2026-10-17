import type { Product } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import {
  buildCheckoutOrderLines,
  getCartItemIdsToRemoveAfterCheckout,
  resolveDirectCheckoutItems,
} from './direct-checkout-items';

const product: Product = {
  id: 'product-a',
  name: '옵션 안전화',
  brand: '브랜드',
  categoryId: 'cat-a',
  price: 24000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
  modelName: null,
  images: [],
  options: [
    {
      id: 'size',
      label: '사이즈',
      required: true,
      choices: [
        { id: 'm', label: 'M', priceDelta: 0 },
        { id: 'l', label: 'L', priceDelta: 2000 },
      ],
    },
  ],
  specifications: [],
  certifications: [],
  shipping: {
    method: '일반 배송',
    estimate: '2~3일',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '',
  },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  isFeatured: false,
};

describe('resolveDirectCheckoutItems', () => {
  it('keeps multiple option lines and quantities for the order payload', () => {
    const resolution = resolveDirectCheckoutItems(
      [
        { productId: product.id, optionId: 'size:m', quantity: 2 },
        { productId: product.id, optionId: 'size:l', quantity: 1 },
      ],
      new Map([[product.id, { ...product, price: 26000 }]]),
    );

    expect(resolution).toMatchObject({ isValid: true });
    if (!resolution.isValid) return;
    expect(
      resolution.items.map(
        ({ id, productId, optionId, quantity, optionLabel, product: latest }) => ({
          id,
          productId,
          optionId,
          quantity,
          optionLabel,
          price: latest.price,
        }),
      ),
    ).toEqual([
      {
        id: 'direct-line-0',
        productId: product.id,
        optionId: 'size:m',
        quantity: 2,
        optionLabel: '사이즈: M',
        price: 26000,
      },
      {
        id: 'direct-line-1',
        productId: product.id,
        optionId: 'size:l',
        quantity: 1,
        optionLabel: '사이즈: L',
        price: 26000,
      },
    ]);
    expect(resolution.items[0]?.id).not.toBe(`cart-${product.id}-size:m`);
    expect(buildCheckoutOrderLines(resolution.items)).toEqual([
      { productId: product.id, optionId: 'size:m', quantity: 2 },
      { productId: product.id, optionId: 'size:l', quantity: 1 },
    ]);
    expect(
      getCartItemIdsToRemoveAfterCheckout(
        'direct',
        resolution.items.map((item) => item.id),
      ),
    ).toEqual([]);
    expect(getCartItemIdsToRemoveAfterCheckout('cart', ['cart-product-a-size:m'])).toEqual([
      'cart-product-a-size:m',
    ]);
  });

  it('rejects a product that disappeared or cannot be purchased now', () => {
    const directLine = [{ productId: product.id, optionId: 'size:m', quantity: 1 }];

    expect(resolveDirectCheckoutItems(directLine, new Map())).toEqual({
      isValid: false,
      reason: 'productUnavailable',
    });
    expect(
      resolveDirectCheckoutItems(
        directLine,
        new Map([[product.id, { ...product, stockStatus: 'soldOut' }]]),
      ),
    ).toEqual({ isValid: false, reason: 'productUnavailable' });
  });

  it('rejects a lookup result whose product ID differs from the requested ID', () => {
    expect(
      resolveDirectCheckoutItems(
        [{ productId: 'requested-product', optionId: 'size:m', quantity: 1 }],
        new Map([['requested-product', product]]),
      ),
    ).toEqual({ isValid: false, reason: 'productUnavailable' });
  });

  it('rejects an option removed from the latest product response', () => {
    expect(
      resolveDirectCheckoutItems(
        [{ productId: product.id, optionId: 'size:xl', quantity: 1 }],
        new Map([[product.id, product]]),
      ),
    ).toEqual({ isValid: false, reason: 'optionUnavailable' });
  });
});
