export const CHECKOUT_SELECTION_STORAGE_KEY = 'eum.checkout-selection.v1';

export type CheckoutSelectionMode = 'defaultAll' | 'explicit';

export interface CheckoutSelectionSnapshot {
  cartItemIds: string[];
  selectionMode: CheckoutSelectionMode;
  checkoutStarted: boolean;
}

const DEFAULT_SELECTION: CheckoutSelectionSnapshot = {
  cartItemIds: [],
  selectionMode: 'defaultAll',
  checkoutStarted: false,
};

const FAILED_CLOSED_SELECTION: CheckoutSelectionSnapshot = {
  cartItemIds: [],
  selectionMode: 'explicit',
  checkoutStarted: true,
};

/** 세션 저장값은 cart item ID와 흐름 구분값만 복원하고, 잘못된 값은 주문 선택을 비웁니다. */
export function parseCheckoutSelection(rawSelection: string | null): CheckoutSelectionSnapshot {
  if (rawSelection === null) return DEFAULT_SELECTION;

  try {
    const parsedSelection: unknown = JSON.parse(rawSelection);
    if (
      typeof parsedSelection !== 'object' ||
      parsedSelection === null ||
      !('version' in parsedSelection) ||
      parsedSelection.version !== 1 ||
      !('cartItemIds' in parsedSelection) ||
      !Array.isArray(parsedSelection.cartItemIds) ||
      !parsedSelection.cartItemIds.every(
        (cartItemId) =>
          typeof cartItemId === 'string' && cartItemId.length > 0 && cartItemId.length <= 200,
      ) ||
      !('selectionMode' in parsedSelection) ||
      (parsedSelection.selectionMode !== 'defaultAll' &&
        parsedSelection.selectionMode !== 'explicit') ||
      !('checkoutStarted' in parsedSelection) ||
      typeof parsedSelection.checkoutStarted !== 'boolean'
    ) {
      return FAILED_CLOSED_SELECTION;
    }

    return {
      cartItemIds: [...new Set(parsedSelection.cartItemIds)],
      selectionMode: parsedSelection.selectionMode,
      checkoutStarted: parsedSelection.checkoutStarted,
    };
  } catch {
    return FAILED_CLOSED_SELECTION;
  }
}

/** 배송지·연락처·결제 등은 제외하고 주문 선택에 필요한 최소값만 직렬화합니다. */
export function serializeCheckoutSelection(selection: CheckoutSelectionSnapshot): string | null {
  if (
    selection.selectionMode === 'defaultAll' &&
    selection.cartItemIds.length === 0 &&
    !selection.checkoutStarted
  ) {
    return null;
  }

  return JSON.stringify({
    version: 1,
    cartItemIds: [...new Set(selection.cartItemIds)],
    selectionMode: selection.selectionMode,
    checkoutStarted: selection.checkoutStarted,
  });
}
