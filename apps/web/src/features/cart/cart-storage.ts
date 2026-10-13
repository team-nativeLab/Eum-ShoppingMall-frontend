import { clampCartQuantity } from '@eum/api/cart';
import type { CartItem, Product } from '@eum/api/types';

/** 장바구니 localStorage 키. 저장 형식을 바꾸면 버전을 올립니다. */
export const CART_STORAGE_KEY = 'eum.cart.v1';

/*
 * TODO(2단계): 상품 조회 API가 생기면 저장 구조를 { productId, quantity }만으로 줄이고,
 * 상품 정보(가격·금액 표시 여부·재고)는 화면에서 서버 최신값으로 다시 받습니다.
 * 지금은 목 단계라 담을 때의 상품 스냅샷을 함께 저장합니다.
 */
interface StoredCart {
  version: 1;
  cartItems: CartItem[];
}

// 저장된 상품 스냅샷이 화면 계산에 필요한 필드를 갖췄는지 확인하는 함수
function isProductShape(candidate: unknown): candidate is Product {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const record = candidate as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.price === 'number' &&
    Number.isFinite(record.price) &&
    record.price >= 0 &&
    typeof record.priceVisible === 'boolean' &&
    (record.stockStatus === 'inStock' || record.stockStatus === 'soldOut')
  );
}

// 저장된 항목 하나를 검증·정리하는 함수. 쓸 수 없으면 null
function toCartItem(candidate: unknown): CartItem | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const record = candidate as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.productId !== 'string' ||
    typeof record.quantity !== 'number' ||
    !isProductShape(record.product) ||
    record.product.id !== record.productId
  ) {
    return null;
  }
  return {
    id: record.id,
    productId: record.productId,
    quantity: clampCartQuantity(record.quantity),
    product: record.product,
  };
}

// 같은 id 또는 같은 상품이 두 번 저장돼 있으면 처음 항목만 남기는 함수(한 상품은 장바구니에 한 줄)
function dedupeCartItems(cartItems: CartItem[]): CartItem[] {
  const seenItemIds = new Set<string>();
  const seenProductIds = new Set<string>();
  return cartItems.filter((cartItem) => {
    if (seenItemIds.has(cartItem.id) || seenProductIds.has(cartItem.productId)) return false;
    seenItemIds.add(cartItem.id);
    seenProductIds.add(cartItem.productId);
    return true;
  });
}

/** 저장 문자열을 장바구니 항목으로 바꾸는 함수. 형식이 다르면 빈 배열, 잘못된 항목은 버립니다. */
export function parseStoredCart(rawCart: string | null): CartItem[] {
  if (rawCart === null) return [];
  try {
    const parsedCart: unknown = JSON.parse(rawCart);
    if (
      typeof parsedCart === 'object' &&
      parsedCart !== null &&
      'version' in parsedCart &&
      parsedCart.version === 1 &&
      'cartItems' in parsedCart &&
      Array.isArray(parsedCart.cartItems)
    ) {
      return dedupeCartItems(
        parsedCart.cartItems
          .map(toCartItem)
          .filter((cartItem): cartItem is CartItem => cartItem !== null),
      );
    }
  } catch {
    // 깨진 값은 빈 장바구니로 취급합니다.
  }
  return [];
}

/** 장바구니 항목을 저장 문자열로 바꾸는 함수 */
export function serializeCart(cartItems: CartItem[]): string {
  const storedCart: StoredCart = { version: 1, cartItems };
  return JSON.stringify(storedCart);
}

/**
 * localStorage에서 장바구니를 읽는 함수.
 * 저장소 접근이 막힌 환경(사생활 보호 모드, 저장소 비활성)에서는 빈 장바구니로 시작합니다.
 */
export function readStoredCart(): CartItem[] {
  try {
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

/**
 * localStorage에 장바구니를 쓰는 함수. 용량 초과·접근 차단이면 저장을 건너뛰고 메모리 상태로만 동작합니다.
 * @returns 저장에 성공했는지
 */
export function writeStoredCart(cartItems: CartItem[]): boolean {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(cartItems));
    return true;
  } catch {
    return false;
  }
}
