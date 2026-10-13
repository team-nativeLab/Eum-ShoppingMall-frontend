import { clampCartQuantity } from '@eum/api/cart';

/** 장바구니는 상품 스냅샷 대신 최신 조회에 필요한 최소 정보만 저장합니다. */
export const CART_STORAGE_KEY = 'eum.cart.v2';
export const LEGACY_CART_STORAGE_KEY = 'eum.cart.v1';

export interface StoredCartLine {
  productId: string;
  quantity: number;
  optionId: string | null;
  optionLabel: string | null;
}

interface StoredCart {
  version: 2;
  cartItems: StoredCartLine[];
}

/** v1 상품 스냅샷 또는 v2 최소 항목에서 복원 가능한 줄만 읽습니다. */
function toStoredCartLine(candidate: unknown): StoredCartLine | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const record = candidate as Record<string, unknown>;
  const productId =
    typeof record.productId === 'string'
      ? record.productId
      : typeof record.product === 'object' &&
          record.product !== null &&
          'id' in record.product &&
          typeof record.product.id === 'string'
        ? record.product.id
        : null;
  if (productId === null || productId.trim() === '' || typeof record.quantity !== 'number') {
    return null;
  }
  return {
    productId,
    quantity: clampCartQuantity(record.quantity),
    optionId: typeof record.optionId === 'string' ? record.optionId : null,
    optionLabel: typeof record.optionLabel === 'string' ? record.optionLabel : null,
  };
}

/** 중복 상품·옵션 줄은 수량을 합치고 최대 허용치를 적용합니다. */
function normalizeCartLines(cartLines: StoredCartLine[]): StoredCartLine[] {
  const uniqueLines = new Map<string, StoredCartLine>();
  for (const cartLine of cartLines) {
    const identity = `${cartLine.productId}\u0000${cartLine.optionId ?? ''}`;
    const existingLine = uniqueLines.get(identity);
    if (existingLine) {
      existingLine.quantity = clampCartQuantity(existingLine.quantity + cartLine.quantity);
    } else {
      uniqueLines.set(identity, { ...cartLine });
    }
  }
  return [...uniqueLines.values()];
}

/** v1/v2 저장 문자열을 최소 상품 항목 배열로 정리합니다. */
export function parseStoredCart(rawCart: string | null): StoredCartLine[] {
  if (rawCart === null) return [];
  try {
    const parsedCart: unknown = JSON.parse(rawCart);
    if (typeof parsedCart !== 'object' || parsedCart === null || !('version' in parsedCart)) {
      return [];
    }
    if (
      (parsedCart.version === 1 || parsedCart.version === 2) &&
      'cartItems' in parsedCart &&
      Array.isArray(parsedCart.cartItems)
    ) {
      return normalizeCartLines(
        parsedCart.cartItems
          .map(toStoredCartLine)
          .filter((cartLine): cartLine is StoredCartLine => cartLine !== null),
      );
    }
  } catch {
    // 잘못된 저장 문자열은 빈 장바구니로 처리합니다.
  }
  return [];
}

/** 최소 상품 항목만 포함한 v2 저장 문자열을 만듭니다. */
export function serializeCart(cartLines: StoredCartLine[]): string {
  const storedCart: StoredCart = { version: 2, cartItems: normalizeCartLines(cartLines) };
  return JSON.stringify(storedCart);
}

/** localStorage에서 v2를 우선 읽고, 없으면 v1 스냅샷을 마이그레이션 대상으로 읽습니다. */
export function readStoredCart(): StoredCartLine[] {
  try {
    const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart !== null) return parseStoredCart(storedCart);
    return parseStoredCart(window.localStorage.getItem(LEGACY_CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** 최소 상품 항목만 localStorage에 저장합니다. 저장 실패 시 메모리 상태는 유지합니다. */
export function writeStoredCart(cartLines: StoredCartLine[]): boolean {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(cartLines));
    try {
      window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch {
      // v2 저장은 성공했으므로 오래된 키 정리 실패로 현재 저장 결과를 되돌리지는 않습니다.
    }
    return true;
  } catch {
    return false;
  }
}
