import type { Product } from '@eum/api/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CART_STORAGE_KEY,
  parseStoredCart,
  readStoredCart,
  serializeCart,
  writeStoredCart,
} from './cart-storage';

const storedProduct: Product = {
  id: 'p-1',
  name: '상품',
  brand: '브랜드',
  categoryId: 'cat',
  price: 1000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
};

// 검증 전 원본 형태 그대로 저장 문자열을 만드는 함수
const rawCart = (cartItems: unknown[]) => JSON.stringify({ version: 1, cartItems });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseStoredCart', () => {
  it('음수·소수 수량은 허용 범위 정수로 맞춥니다', () => {
    const parsedItems = parseStoredCart(
      rawCart([
        { id: 'a', productId: 'p-1', quantity: -3, product: storedProduct },
        { id: 'b', productId: 'p-2', quantity: 2.8, product: { ...storedProduct, id: 'p-2' } },
      ]),
    );
    expect(parsedItems.map((cartItem) => cartItem.quantity)).toEqual([1, 2]);
  });

  it('상품이 없거나 필드 타입이 틀린 항목은 버립니다', () => {
    const parsedItems = parseStoredCart(
      rawCart([
        { id: 'a', productId: 'p-1', quantity: 1 },
        { id: 'b', productId: 'p-1', quantity: 1, product: { ...storedProduct, price: '1000' } },
        {
          id: 'c',
          productId: 'p-1',
          quantity: 1,
          product: { ...storedProduct, priceVisible: 'yes' },
        },
        { id: 'd', productId: 'p-other', quantity: 1, product: storedProduct },
        { id: 'e', productId: 'p-1', quantity: 1, product: storedProduct },
      ]),
    );
    expect(parsedItems.map((cartItem) => cartItem.id)).toEqual(['e']);
  });

  it('음수 가격 상품은 버립니다', () => {
    const parsedItems = parseStoredCart(
      rawCart([
        { id: 'a', productId: 'p-1', quantity: 1, product: { ...storedProduct, price: -1 } },
      ]),
    );
    expect(parsedItems).toEqual([]);
  });

  it('같은 id·같은 상품이 중복되면 처음 항목만 남깁니다', () => {
    const otherProduct = { ...storedProduct, id: 'p-2' };
    const parsedItems = parseStoredCart(
      rawCart([
        { id: 'a', productId: 'p-1', quantity: 1, product: storedProduct },
        { id: 'b', productId: 'p-1', quantity: 5, product: storedProduct },
        { id: 'a', productId: 'p-2', quantity: 2, product: otherProduct },
        { id: 'c', productId: 'p-2', quantity: 3, product: otherProduct },
      ]),
    );
    expect(parsedItems.map((cartItem) => [cartItem.id, cartItem.quantity])).toEqual([
      ['a', 1],
      ['c', 3],
    ]);
  });

  it('버전이 다르거나 깨진 값은 빈 배열입니다', () => {
    expect(parseStoredCart(JSON.stringify({ version: 2, cartItems: [] }))).toEqual([]);
    expect(parseStoredCart('{oops')).toEqual([]);
  });
});

describe('저장소 접근 실패', () => {
  it('setItem이 실패해도 예외를 밖으로 던지지 않습니다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(writeStoredCart([])).toBe(false);
  });

  it('getItem이 실패하면 빈 장바구니로 시작합니다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStoredCart()).toEqual([]);
  });

  it('정상 저장 후 다시 읽을 수 있습니다', () => {
    const cartItems = [{ id: 'cart-p-1', productId: 'p-1', quantity: 2, product: storedProduct }];
    expect(writeStoredCart(cartItems)).toBe(true);
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe(serializeCart(cartItems));
    expect(readStoredCart()).toEqual(cartItems);
  });
});
