import { CART_MAX_QUANTITY } from '@eum/api/cart';

export const CHECKOUT_SELECTION_STORAGE_KEY = 'eum.checkout-selection.v1';

export type CheckoutSelectionMode = 'defaultAll' | 'explicit';
export type CheckoutSelectionSource = 'cart' | 'direct';

export interface DirectCheckoutLine {
  productId: string;
  optionId: string | null;
  quantity: number;
}

export interface CheckoutSelectionSnapshot {
  cartItemIds: string[];
  directLines: DirectCheckoutLine[];
  selectionMode: CheckoutSelectionMode;
  selectionSource: CheckoutSelectionSource;
  checkoutStarted: boolean;
}

const DEFAULT_SELECTION: CheckoutSelectionSnapshot = {
  cartItemIds: [],
  directLines: [],
  selectionMode: 'defaultAll',
  selectionSource: 'cart',
  checkoutStarted: false,
};

const FAILED_CLOSED_SELECTION: CheckoutSelectionSnapshot = {
  cartItemIds: [],
  directLines: [],
  selectionMode: 'explicit',
  selectionSource: 'cart',
  checkoutStarted: true,
};

const MAX_PRODUCT_ID_LENGTH = 200;
const MAX_OPTION_ID_LENGTH = 500;

function isDirectCheckoutLine(value: unknown): value is DirectCheckoutLine {
  if (typeof value !== 'object' || value === null) return false;
  if (!('productId' in value) || typeof value.productId !== 'string') return false;
  if (value.productId.length === 0 || value.productId.length > MAX_PRODUCT_ID_LENGTH) return false;
  if (!('optionId' in value)) return false;
  if (
    value.optionId !== null &&
    (typeof value.optionId !== 'string' ||
      value.optionId.length === 0 ||
      value.optionId.length > MAX_OPTION_ID_LENGTH)
  ) {
    return false;
  }
  return (
    'quantity' in value &&
    typeof value.quantity === 'number' &&
    Number.isInteger(value.quantity) &&
    value.quantity >= 1 &&
    value.quantity <= CART_MAX_QUANTITY
  );
}

/** 세션 저장값은 cart item ID와 흐름 구분값만 복원하고, 잘못된 값은 주문 선택을 비웁니다. */
export function parseCheckoutSelection(rawSelection: string | null): CheckoutSelectionSnapshot {
  if (rawSelection === null) return DEFAULT_SELECTION;

  try {
    const parsedSelection: unknown = JSON.parse(rawSelection);
    if (
      typeof parsedSelection !== 'object' ||
      parsedSelection === null ||
      !('version' in parsedSelection) ||
      (parsedSelection.version !== 1 && parsedSelection.version !== 2) ||
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

    const selectionSource =
      parsedSelection.version === 1
        ? 'cart'
        : 'selectionSource' in parsedSelection &&
            (parsedSelection.selectionSource === 'cart' ||
              parsedSelection.selectionSource === 'direct')
          ? parsedSelection.selectionSource
          : null;
    const directLines =
      parsedSelection.version === 1
        ? []
        : 'directLines' in parsedSelection &&
            Array.isArray(parsedSelection.directLines) &&
            parsedSelection.directLines.every(isDirectCheckoutLine)
          ? parsedSelection.directLines
          : null;
    if (
      selectionSource === null ||
      directLines === null ||
      (selectionSource === 'direct' &&
        (!parsedSelection.checkoutStarted || directLines.length === 0)) ||
      (selectionSource === 'cart' && directLines.length > 0)
    ) {
      return FAILED_CLOSED_SELECTION;
    }
    const directLineKeys = new Set<string>();
    for (const directLine of directLines) {
      const lineKey = `${directLine.productId}\u0000${directLine.optionId ?? ''}`;
      if (directLineKeys.has(lineKey)) return FAILED_CLOSED_SELECTION;
      directLineKeys.add(lineKey);
    }

    return {
      cartItemIds: [...new Set(parsedSelection.cartItemIds)],
      directLines: directLines.map((line) => ({ ...line })),
      selectionMode: parsedSelection.selectionMode,
      selectionSource,
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
    selection.directLines.length === 0 &&
    !selection.checkoutStarted
  ) {
    return null;
  }

  return JSON.stringify({
    version: 2,
    cartItemIds: [...new Set(selection.cartItemIds)],
    directLines: selection.directLines.map((line) => ({
      productId: line.productId,
      optionId: line.optionId,
      quantity: line.quantity,
    })),
    selectionMode: selection.selectionMode,
    selectionSource: selection.selectionSource,
    checkoutStarted: selection.checkoutStarted,
  });
}
