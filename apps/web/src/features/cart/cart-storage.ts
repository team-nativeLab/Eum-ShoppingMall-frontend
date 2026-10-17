import { CART_MAX_QUANTITY, clampCartQuantity } from '@eum/api/cart';

/** 장바구니는 상품 스냅샷 대신 최신 조회에 필요한 최소 정보만 저장합니다. */
export const CART_STORAGE_KEY = 'eum.cart.v2';
export const LEGACY_CART_STORAGE_KEY = 'eum.cart.v1';
export const ORDERED_CART_CLEANUP_STORAGE_KEY = 'eum.cart.pending-order-cleanup.v1';

export interface StoredCartLine {
  productId: string;
  quantity: number;
  optionId: string | null;
  optionLabel: string | null;
}

export type OrderedCartLine = Pick<StoredCartLine, 'productId' | 'optionId' | 'quantity'>;

interface PendingOrderedCartCleanup {
  version: 1;
  phase: PendingOrderedCartCleanupPhase;
  orderedLines: OrderedCartLine[];
  beforeLines: OrderedCartLine[] | null;
  afterLines: OrderedCartLine[] | null;
  complete?: true;
}

export type PendingOrderedCartCleanupPhase = 'prepared' | 'applying' | 'applied';

export interface PendingOrderedCartCleanupIntent {
  phase: PendingOrderedCartCleanupPhase;
  orderedLines: OrderedCartLine[];
  beforeLines: OrderedCartLine[] | null;
  afterLines: OrderedCartLine[] | null;
}

export type StoredCartReadResult = { ok: true; cartLines: StoredCartLine[] } | { ok: false };

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

function toStoredSnapshotLine(line: StoredCartLine | OrderedCartLine): StoredCartLine {
  return {
    productId: line.productId,
    quantity: line.quantity,
    optionId: line.optionId,
    optionLabel: 'optionLabel' in line ? line.optionLabel : null,
  };
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

/** 성공한 주문 수량만 최신 장바구니 줄에서 차감해 이후 추가 수량을 보존합니다. */
export function subtractOrderedCartLines(
  storedLines: readonly StoredCartLine[],
  orderedLines: readonly OrderedCartLine[],
): StoredCartLine[] {
  const orderedQuantities = new Map<string, number>();
  for (const orderedLine of orderedLines) {
    const identity = `${orderedLine.productId}\u0000${orderedLine.optionId ?? ''}`;
    orderedQuantities.set(identity, (orderedQuantities.get(identity) ?? 0) + orderedLine.quantity);
  }

  return storedLines.flatMap((storedLine) => {
    const identity = `${storedLine.productId}\u0000${storedLine.optionId ?? ''}`;
    const orderedQuantity = orderedQuantities.get(identity) ?? 0;
    const remainingQuantity = Math.max(0, storedLine.quantity - orderedQuantity);
    orderedQuantities.set(identity, Math.max(0, orderedQuantity - storedLine.quantity));
    return remainingQuantity > 0 ? [{ ...storedLine, quantity: remainingQuantity }] : [];
  });
}

/** 최소 상품 항목만 포함한 v2 저장 문자열을 만듭니다. */
export function serializeCart(cartLines: StoredCartLine[]): string {
  const storedCart: StoredCart = { version: 2, cartItems: normalizeCartLines(cartLines) };
  return JSON.stringify(storedCart);
}

/** localStorage에서 v2를 우선 읽고, 없으면 v1 스냅샷을 마이그레이션 대상으로 읽습니다. */
export function readStoredCart(): StoredCartLine[] {
  const result = tryReadStoredCart();
  return result.ok ? result.cartLines : [];
}

/** Read status distinguishes an unavailable storage API from a valid empty cart. */
export function tryReadStoredCart(): StoredCartReadResult {
  try {
    const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart !== null) return { ok: true, cartLines: parseStoredCart(storedCart) };
    return {
      ok: true,
      cartLines: parseStoredCart(window.localStorage.getItem(LEGACY_CART_STORAGE_KEY)),
    };
  } catch {
    return { ok: false };
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

function isOrderedCartLine(value: unknown): value is OrderedCartLine {
  if (typeof value !== 'object' || value === null) return false;
  if (!('productId' in value) || typeof value.productId !== 'string') return false;
  if (value.productId.trim() === '' || value.productId.length > 200) return false;
  if (!('optionId' in value)) return false;
  if (
    value.optionId !== null &&
    (typeof value.optionId !== 'string' ||
      value.optionId.length === 0 ||
      value.optionId.length > 500)
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

function normalizeOrderedCartLines(lines: readonly OrderedCartLine[]): OrderedCartLine[] {
  const normalized = new Map<string, OrderedCartLine>();
  for (const line of lines) {
    const identity = `${line.productId}\u0000${line.optionId ?? ''}`;
    const current = normalized.get(identity);
    if (current) {
      current.quantity = clampCartQuantity(current.quantity + line.quantity);
    } else {
      normalized.set(identity, { ...line });
    }
  }
  return [...normalized.values()];
}

function isPendingOrderedCartCleanupPhase(value: unknown): value is PendingOrderedCartCleanupPhase {
  return value === 'prepared' || value === 'applying' || value === 'applied';
}

/** Compares cart contents while ignoring option labels, which are presentation data. */
export function areCartLineSnapshotsEqual(
  left: readonly (StoredCartLine | OrderedCartLine)[],
  right: readonly (StoredCartLine | OrderedCartLine)[],
): boolean {
  const toOrderedLines = (lines: readonly (StoredCartLine | OrderedCartLine)[]) =>
    normalizeOrderedCartLines(
      lines.map(({ productId, optionId, quantity }) => ({ productId, optionId, quantity })),
    ).sort((leftLine, rightLine) => {
      const leftIdentity = `${leftLine.productId}\u0000${leftLine.optionId ?? ''}`;
      const rightIdentity = `${rightLine.productId}\u0000${rightLine.optionId ?? ''}`;
      return leftIdentity < rightIdentity ? -1 : leftIdentity > rightIdentity ? 1 : 0;
    });
  return JSON.stringify(toOrderedLines(left)) === JSON.stringify(toOrderedLines(right));
}

/** Compares only the ordered product/option quantities, ignoring unrelated cart rows. */
export function areOrderedCartSnapshotsEqual(
  actualLines: readonly (StoredCartLine | OrderedCartLine)[],
  expectedLines: readonly (StoredCartLine | OrderedCartLine)[],
  orderedLines: readonly OrderedCartLine[],
): boolean {
  const orderedIdentities = new Set(
    orderedLines.map((line) => `${line.productId}\u0000${line.optionId ?? ''}`),
  );
  const selectOrderedLines = (lines: readonly (StoredCartLine | OrderedCartLine)[]) =>
    lines.filter((line) => orderedIdentities.has(`${line.productId}\u0000${line.optionId ?? ''}`));
  return areCartLineSnapshotsEqual(
    selectOrderedLines(actualLines),
    selectOrderedLines(expectedLines),
  );
}

/** 주문 성공 후 장바구니 정리가 보류된 경우에만 세션에 최소 주문 라인을 저장합니다. */
export function writePendingOrderedCartCleanup(
  orderedLines: readonly OrderedCartLine[],
  beforeLines: readonly (StoredCartLine | OrderedCartLine)[] | null = readStoredCart(),
  afterLines: readonly (StoredCartLine | OrderedCartLine)[] | null = beforeLines === null
    ? null
    : subtractOrderedCartLines(beforeLines.map(toStoredSnapshotLine), orderedLines),
  phase: PendingOrderedCartCleanupPhase = 'prepared',
): boolean {
  try {
    if (orderedLines.length === 0) {
      window.sessionStorage.removeItem(ORDERED_CART_CLEANUP_STORAGE_KEY);
      return true;
    }
    const normalizedOrderedLines = normalizeOrderedCartLines(orderedLines);
    const normalizedBeforeLines =
      beforeLines === null
        ? null
        : normalizeOrderedCartLines(
            beforeLines.map(({ productId, optionId, quantity }) => ({
              productId,
              optionId,
              quantity,
            })),
          );
    const normalizedAfterLines =
      afterLines === null
        ? null
        : normalizeOrderedCartLines(
            afterLines.map(({ productId, optionId, quantity }) => ({
              productId,
              optionId,
              quantity,
            })),
          );
    const pendingCleanup: PendingOrderedCartCleanup = {
      version: 1,
      phase,
      orderedLines: normalizedOrderedLines,
      beforeLines: normalizedBeforeLines,
      afterLines: normalizedAfterLines,
    };
    window.sessionStorage.setItem(ORDERED_CART_CLEANUP_STORAGE_KEY, JSON.stringify(pendingCleanup));
    return true;
  } catch {
    return false;
  }
}

/** 동일 탭 세션에서 보류된 주문 장바구니 정리 의도를 읽습니다. */
export function readPendingOrderedCartCleanupIntent(): PendingOrderedCartCleanupIntent | null {
  try {
    const rawCleanup = window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY);
    if (rawCleanup === null) return null;
    const parsedCleanup: unknown = JSON.parse(rawCleanup);
    if (
      typeof parsedCleanup !== 'object' ||
      parsedCleanup === null ||
      !('version' in parsedCleanup) ||
      parsedCleanup.version !== 1 ||
      ('phase' in parsedCleanup && !isPendingOrderedCartCleanupPhase(parsedCleanup.phase)) ||
      ('complete' in parsedCleanup && parsedCleanup.complete === true) ||
      !('orderedLines' in parsedCleanup) ||
      !Array.isArray(parsedCleanup.orderedLines) ||
      !parsedCleanup.orderedLines.every(isOrderedCartLine) ||
      !('beforeLines' in parsedCleanup) ||
      !(
        parsedCleanup.beforeLines === null ||
        (Array.isArray(parsedCleanup.beforeLines) &&
          parsedCleanup.beforeLines.every(isOrderedCartLine))
      ) ||
      !('afterLines' in parsedCleanup) ||
      !(
        parsedCleanup.afterLines === null ||
        (Array.isArray(parsedCleanup.afterLines) &&
          parsedCleanup.afterLines.every(isOrderedCartLine))
      )
    ) {
      return null;
    }
    return {
      // Older session intents have no phase and are safe to treat as not yet applied.
      phase:
        'phase' in parsedCleanup && isPendingOrderedCartCleanupPhase(parsedCleanup.phase)
          ? parsedCleanup.phase
          : 'prepared',
      orderedLines: normalizeOrderedCartLines(parsedCleanup.orderedLines),
      beforeLines:
        parsedCleanup.beforeLines === null
          ? null
          : normalizeOrderedCartLines(parsedCleanup.beforeLines),
      afterLines:
        parsedCleanup.afterLines === null
          ? null
          : normalizeOrderedCartLines(parsedCleanup.afterLines),
    };
  } catch {
    return null;
  }
}

/** 동일 탭 세션에서 보류된 주문 수량만 읽습니다. */
export function readPendingOrderedCartCleanup(): OrderedCartLine[] {
  return readPendingOrderedCartCleanupIntent()?.orderedLines ?? [];
}

/** localStorage 정리 성공 뒤 제거 실패에 대비해 intent를 완료 표시합니다. */
export function markPendingOrderedCartCleanupComplete(): boolean {
  try {
    const completedCleanup: PendingOrderedCartCleanup = {
      version: 1,
      phase: 'applied',
      orderedLines: [],
      beforeLines: [],
      afterLines: [],
      complete: true,
    };
    window.sessionStorage.setItem(
      ORDERED_CART_CLEANUP_STORAGE_KEY,
      JSON.stringify(completedCleanup),
    );
    return true;
  } catch {
    return false;
  }
}

/** localStorage 정리가 성공한 뒤 보류된 주문 라인을 세션에서 제거합니다. */
export function clearPendingOrderedCartCleanup(): boolean {
  try {
    window.sessionStorage.removeItem(ORDERED_CART_CLEANUP_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
