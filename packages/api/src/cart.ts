import { canBuyNow } from './price';
import type { CartItem, Product } from './types';

/** 장바구니 수량 하한 */
export const CART_MIN_QUANTITY = 1;
/**
 * 장바구니 수량 상한(임시 값).
 * 상품별 구매 제한이 서버에서 오면 그 값으로 바꿉니다.
 */
export const CART_MAX_QUANTITY = 999;

/** 주문할 수 없는 이유. optionUnavailable은 담은 옵션이 상품에서 사라졌거나 필수 옵션이 빠진 경우입니다. */
export type CartUnavailableReason = 'priceHidden' | 'soldOut' | 'optionUnavailable';

// 장바구니 옵션 식별자 형식: "옵션ID:선택지ID|옵션ID:선택지ID"
const OPTION_PAIR_SEPARATOR = '|';
const OPTION_CHOICE_SEPARATOR = ':';

/** 상세 화면에서 고른 옵션 하나(옵션 ID + 선택지 ID) */
export interface CartOptionSelection {
  optionId: string;
  choiceId: string;
}

/** 장바구니 옵션 식별자를 최신 상품 옵션으로 해석한 결과 */
export type CartOptionResolution =
  { isAvailable: true; optionLabel: string | null; priceDelta: number } | { isAvailable: false };

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

/** 고른 옵션 목록을 장바구니 줄 식별자(optionId)로 바꾸는 함수. 고른 옵션이 없으면 null */
export function createCartOptionId(selections: readonly CartOptionSelection[]): string | null {
  if (selections.length === 0) return null;
  return selections
    .map((selection) => selection.optionId + OPTION_CHOICE_SEPARATOR + selection.choiceId)
    .join(OPTION_PAIR_SEPARATOR);
}

/** 화면에 보여 줄 옵션 문구("색상: 백색 / 사이즈: 260mm")를 만드는 함수 */
export function formatCartOptionLabel(
  labels: readonly { optionLabel: string; choiceLabel: string }[],
): string | null {
  if (labels.length === 0) return null;
  return labels.map((label) => label.optionLabel + ': ' + label.choiceLabel).join(' / ');
}

/**
 * 장바구니 줄의 옵션 식별자를 최신 상품 옵션으로 해석하는 함수.
 * 옵션·선택지가 상품에서 사라졌거나, 필수 옵션이 빠졌거나, 식별자 형식이 깨졌으면 주문할 수 없습니다.
 * 해석되면 최신 옵션 문구와 추가금(priceDelta 합계)을 돌려줍니다.
 */
export function resolveCartOption(
  product: Pick<Product, 'options'>,
  cartOptionId: string | null,
): CartOptionResolution {
  const selectedChoiceIds = new Map<string, string>();
  if (cartOptionId !== null) {
    for (const optionPair of cartOptionId.split(OPTION_PAIR_SEPARATOR)) {
      const separatorIndex = optionPair.indexOf(OPTION_CHOICE_SEPARATOR);
      if (separatorIndex <= 0) return { isAvailable: false };
      const optionId = optionPair.slice(0, separatorIndex);
      if (selectedChoiceIds.has(optionId)) return { isAvailable: false };
      selectedChoiceIds.set(optionId, optionPair.slice(separatorIndex + 1));
    }
  }

  const optionLabels: { optionLabel: string; choiceLabel: string }[] = [];
  let priceDelta = 0;
  for (const [optionId, choiceId] of selectedChoiceIds) {
    const productOption = product.options.find((candidate) => candidate.id === optionId);
    const choice = productOption?.choices.find((candidate) => candidate.id === choiceId);
    if (!productOption || !choice) return { isAvailable: false };
    optionLabels.push({ optionLabel: productOption.label, choiceLabel: choice.label });
    priceDelta += choice.priceDelta;
  }
  const isMissingRequiredOption = product.options.some(
    (productOption) => productOption.required && !selectedChoiceIds.has(productOption.id),
  );
  if (isMissingRequiredOption) return { isAvailable: false };
  return { isAvailable: true, optionLabel: formatCartOptionLabel(optionLabels), priceDelta };
}

// 상품 상태와 옵션으로 주문 불가 이유를 정하는 함수. 주문 가능하면 null
function getUnavailableReason(cartItem: CartItem): CartUnavailableReason | null {
  const { product } = cartItem;
  if (!canBuyNow(product)) return product.stockStatus === 'soldOut' ? 'soldOut' : 'priceHidden';
  if (!resolveCartOption(product, cartItem.optionId).isAvailable) return 'optionUnavailable';
  return null;
}

/**
 * 장바구니 항목을 주문 가능 / 주문할 수 없는 상품으로 나누는 함수.
 * 금액 미표시(priceVisible=false) 상품, 품절 상품, 옵션이 사라진 줄은 '주문할 수 없는 상품' 그룹으로 갑니다.
 */
export function groupCartItems(cartItems: readonly CartItem[]): CartGroups {
  const orderableItems: CartItem[] = [];
  const unorderableItems: UnorderableCartItem[] = [];
  for (const cartItem of cartItems) {
    const reason = getUnavailableReason(cartItem);
    if (reason === null) {
      orderableItems.push(cartItem);
    } else {
      unorderableItems.push({ cartItem, reason });
    }
  }
  return { orderableItems, unorderableItems };
}

/**
 * 선택된 항목 중 주문 가능한 것만 합산하는 함수. 단가는 판매가 + 옵션 추가금입니다.
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
    const optionResolution = resolveCartOption(cartItem.product, cartItem.optionId);
    const optionPriceDelta = optionResolution.isAvailable ? optionResolution.priceDelta : 0;
    productTotal += ((cartItem.product.price ?? 0) + optionPriceDelta) * cartItem.quantity;
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
