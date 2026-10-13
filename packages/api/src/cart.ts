import { canBuyNow } from './price';
import type { CartItem, Product } from './types';

/** 장바구니 수량 하한 */
export const CART_MIN_QUANTITY = 1;
/**
 * 장바구니 수량 상한(임시 값).
 * 상품별 구매 제한이 서버에서 오면 그 값으로 바꿉니다.
 */
export const CART_MAX_QUANTITY = 999;

/** 주문할 수 없는 이유 */
export type CartUnavailableReason = 'priceHidden' | 'soldOut';

/** 주문할 수 없는 장바구니 항목과 그 이유 */
export interface UnorderableCartItem {
  cartItem: CartItem;
  reason: CartUnavailableReason;
}

/** 장바구니 화면의 두 그룹: 주문 가능 / '주문할 수 없는 상품' */
export interface CartGroups {
  orderableItems: CartItem[];
  unorderableItems: UnorderableCartItem[];
}

/** 장바구니 합계 */
export interface CartTotals {
  /** 주문 가능한 항목 수 */
  orderableCount: number;
  /** 주문 가능하면서 선택된 항목 수 */
  selectedOrderableCount: number;
  /** 주문에서 빠지는(주문할 수 없는) 항목 수 */
  excludedCount: number;
  /** 선택된 주문 가능 항목의 상품 금액 합계(원) */
  productTotal: number;
}

/** 수량을 장바구니 허용 범위로 맞추는 함수. 소수·NaN은 하한으로 처리합니다. */
export function clampCartQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return CART_MIN_QUANTITY;
  const wholeQuantity = Math.floor(quantity);
  return Math.min(CART_MAX_QUANTITY, Math.max(CART_MIN_QUANTITY, wholeQuantity));
}

// 상품 상태로 주문 불가 이유를 정하는 함수. 주문 가능하면 null
function getUnavailableReason(product: Product): CartUnavailableReason | null {
  if (canBuyNow(product)) return null;
  return product.stockStatus === 'soldOut' ? 'soldOut' : 'priceHidden';
}

/**
 * 장바구니 항목을 주문 가능 / 주문할 수 없는 상품으로 나누는 함수.
 * 금액 미표시(priceVisible=false) 상품과 품절 상품은 '주문할 수 없는 상품' 그룹으로 갑니다.
 */
export function groupCartItems(cartItems: readonly CartItem[]): CartGroups {
  const orderableItems: CartItem[] = [];
  const unorderableItems: UnorderableCartItem[] = [];
  for (const cartItem of cartItems) {
    const reason = getUnavailableReason(cartItem.product);
    if (reason === null) {
      orderableItems.push(cartItem);
    } else {
      unorderableItems.push({ cartItem, reason });
    }
  }
  return { orderableItems, unorderableItems };
}

/**
 * 선택된 항목 중 주문 가능한 것만 합산하는 함수.
 * selectedItemIds를 주지 않으면 주문 가능한 항목 전체를 선택한 것으로 봅니다.
 */
export function calculateCartTotals(
  cartItems: readonly CartItem[],
  selectedItemIds?: ReadonlySet<string>,
): CartTotals {
  const { orderableItems, unorderableItems } = groupCartItems(cartItems);
  let productTotal = 0;
  let selectedOrderableCount = 0;
  for (const cartItem of orderableItems) {
    if (selectedItemIds && !selectedItemIds.has(cartItem.id)) continue;
    selectedOrderableCount += 1;
    productTotal += (cartItem.product.price ?? 0) * cartItem.quantity;
  }
  return {
    orderableCount: orderableItems.length,
    selectedOrderableCount,
    excludedCount: unorderableItems.length,
    productTotal,
  };
}

/**
 * 상품을 장바구니에 담는 함수. 이미 있으면 수량을 더하고, 없으면 새 항목을 끝에 붙입니다.
 * 원본 배열은 바꾸지 않습니다.
 */
export function addProductToCart(
  cartItems: readonly CartItem[],
  product: Product,
  quantity: number,
  optionId: string | null,
  optionLabel: string | null,
  createCartItemId: () => string,
): CartItem[] {
  const existingItem = cartItems.find(
    (cartItem) => cartItem.productId === product.id && cartItem.optionId === optionId,
  );
  if (existingItem) {
    return cartItems.map((cartItem) =>
      cartItem.id === existingItem.id
        ? { ...cartItem, product, quantity: clampCartQuantity(cartItem.quantity + quantity) }
        : cartItem,
    );
  }
  return [
    ...cartItems,
    {
      id: createCartItemId(),
      productId: product.id,
      quantity: clampCartQuantity(quantity),
      optionId,
      optionLabel,
      product,
    },
  ];
}

/** 항목 수량을 바꾸는 함수. 범위를 벗어난 값은 허용 범위로 맞춥니다. */
export function updateCartItemQuantity(
  cartItems: readonly CartItem[],
  cartItemId: string,
  quantity: number,
): CartItem[] {
  return cartItems.map((cartItem) =>
    cartItem.id === cartItemId ? { ...cartItem, quantity: clampCartQuantity(quantity) } : cartItem,
  );
}

/** 여러 항목을 한 번에 지우는 함수 */
export function removeCartItems(
  cartItems: readonly CartItem[],
  cartItemIds: ReadonlySet<string>,
): CartItem[] {
  return cartItems.filter((cartItem) => !cartItemIds.has(cartItem.id));
}
