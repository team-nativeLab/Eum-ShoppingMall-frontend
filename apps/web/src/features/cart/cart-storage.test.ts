import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  parseStoredCart,
  readStoredCart,
  serializeCart,
  writeStoredCart,
} from './cart-storage';

const rawCart = (version: number, cartItems: unknown[]) => JSON.stringify({ version, cartItems });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseStoredCart', () => {
  it('v1 상품 스냅샷에서 ID·수량·옵션만 추출합니다', () => {
    const parsedLines = parseStoredCart(
      rawCart(1, [
        {
          id: 'cart-old',
          productId: 'p-1',
          quantity: 2.8,
          optionId: 'blue',
          optionLabel: '파랑',
          product: { id: 'p-1', name: '오래된 상품 정보', price: 1 },
        },
        { productId: 'p-missing', quantity: 1, product: { id: 'p-missing' } },
      ]),
    );
    expect(parsedLines).toEqual([
      { productId: 'p-1', quantity: 2, optionId: 'blue', optionLabel: '파랑' },
      { productId: 'p-missing', quantity: 1, optionId: null, optionLabel: null },
    ]);
  });

  it('v1 스냅샷의 가격 없이도 상품 ID를 복원할 수 있습니다', () => {
    expect(
      parseStoredCart(rawCart(1, [{ id: 'old', quantity: 1, product: { id: 'p-1' } }])),
    ).toEqual([{ productId: 'p-1', quantity: 1, optionId: null, optionLabel: null }]);
  });

  it('상품 ID나 수량 형식이 잘못된 줄은 버리고 수량을 허용 범위로 맞춥니다', () => {
    const parsedLines = parseStoredCart(
      rawCart(2, [
        { productId: 'p-1', quantity: -3 },
        { productId: 'p-2', quantity: 2.8 },
        { productId: '', quantity: 1 },
        { productId: 'p-3', quantity: '2' },
        { quantity: 1 },
      ]),
    );
    expect(parsedLines).toEqual([
      { productId: 'p-1', quantity: 1, optionId: null, optionLabel: null },
      { productId: 'p-2', quantity: 2, optionId: null, optionLabel: null },
    ]);
  });

  it('중복 상품·옵션 줄의 수량은 합치고 옵션이 다르면 분리합니다', () => {
    const parsedLines = parseStoredCart(
      rawCart(2, [
        { productId: 'p-1', quantity: 1, optionId: 'blue', optionLabel: '파랑' },
        { productId: 'p-1', quantity: 2, optionId: 'blue', optionLabel: '파랑' },
        { productId: 'p-1', quantity: 4, optionId: 'red', optionLabel: '빨강' },
      ]),
    );
    expect(parsedLines).toEqual([
      { productId: 'p-1', quantity: 3, optionId: 'blue', optionLabel: '파랑' },
      { productId: 'p-1', quantity: 4, optionId: 'red', optionLabel: '빨강' },
    ]);
  });

  it('지원하지 않는 버전이나 잘못된 JSON은 빈 배열입니다', () => {
    expect(parseStoredCart(rawCart(3, []))).toEqual([]);
    expect(parseStoredCart('{oops')).toEqual([]);
    expect(parseStoredCart(null)).toEqual([]);
  });
});

describe('저장소 접근 실패와 마이그레이션', () => {
  it('setItem 실패를 메모리 상태로 넘기고 예외를 밖으로 던지지 않습니다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(writeStoredCart([])).toBe(false);
  });

  it('getItem 실패하면 빈 장바구니로 시작합니다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStoredCart()).toEqual([]);
  });

  it('v2를 우선 읽고, v2가 없으면 v1 저장값을 변환해 읽습니다', () => {
    window.localStorage.setItem(
      LEGACY_CART_STORAGE_KEY,
      rawCart(1, [{ id: 'old', productId: 'p-1', quantity: 2, product: { id: 'p-1' } }]),
    );
    expect(readStoredCart()).toEqual([
      { productId: 'p-1', quantity: 2, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, rawCart(2, []));
    expect(readStoredCart()).toEqual([]);
  });

  it('저장 결과에는 상품 스냅샷이 포함되지 않습니다', () => {
    window.localStorage.setItem(LEGACY_CART_STORAGE_KEY, rawCart(1, []));
    const cartLines = [{ productId: 'p-1', quantity: 2, optionId: 'blue', optionLabel: '파랑' }];
    expect(writeStoredCart(cartLines)).toBe(true);
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);
    expect(rawValue).toBe(serializeCart(cartLines));
    expect(rawValue).not.toContain('name');
    expect(readStoredCart()).toEqual(cartLines);
    expect(window.localStorage.getItem(LEGACY_CART_STORAGE_KEY)).toBeNull();
  });
});
