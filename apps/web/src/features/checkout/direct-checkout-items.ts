import { CART_MAX_QUANTITY, resolveCartOption } from '@eum/api/cart';
import { canBuyNow } from '@eum/api/price';
import type { CartItem, CreateOrderInput, Product } from '@eum/api/types';
import type { CheckoutSelectionSource, DirectCheckoutLine } from './checkout-selection-storage';

export type DirectCheckoutItemsResolution =
  | { isValid: true; items: CartItem[] }
  | { isValid: false; reason: 'productUnavailable' | 'optionUnavailable' };

/** 최신 상품 응답으로 직접 주문 줄을 다시 검증하고 표시용 CartItem을 만듭니다. */
export function resolveDirectCheckoutItems(
  directLines: readonly DirectCheckoutLine[],
  productsById: ReadonlyMap<string, Product>,
): DirectCheckoutItemsResolution {
  if (directLines.length === 0) {
    return { isValid: false, reason: 'productUnavailable' };
  }

  const items: CartItem[] = [];
  for (const [lineIndex, directLine] of directLines.entries()) {
    const product = productsById.get(directLine.productId);
    if (!product || product.id !== directLine.productId || !canBuyNow(product)) {
      return { isValid: false, reason: 'productUnavailable' };
    }
    if (
      !Number.isInteger(directLine.quantity) ||
      directLine.quantity < 1 ||
      directLine.quantity > CART_MAX_QUANTITY
    ) {
      return { isValid: false, reason: 'productUnavailable' };
    }

    const option = resolveCartOption(product, directLine.optionId);
    if (!option.isAvailable) {
      return { isValid: false, reason: 'optionUnavailable' };
    }
    items.push({
      id: `direct-line-${lineIndex}`,
      productId: product.id,
      quantity: directLine.quantity,
      optionId: directLine.optionId,
      optionLabel: option.optionLabel,
      product,
    });
  }

  return { isValid: true, items };
}

/** 성공한 cart checkout만 실제 장바구니 줄을 정리하도록 대상 ID를 고릅니다. */
export function getCartItemIdsToRemoveAfterCheckout(
  selectionSource: CheckoutSelectionSource,
  selectedItemIds: readonly string[],
): string[] {
  return selectionSource === 'cart' ? [...selectedItemIds] : [];
}

/** cart와 direct checkout 줄을 서버 주문 입력의 공통 상품 형태로 바꿉니다. */
export function buildCheckoutOrderLines(items: readonly CartItem[]): CreateOrderInput['lines'] {
  return items.map(({ productId, quantity, optionId }) => ({
    productId,
    quantity,
    optionId,
  }));
}
