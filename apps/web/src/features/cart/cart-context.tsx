'use client';

import {
  addProductToCart,
  calculateCartTotals,
  clampCartQuantity,
  groupCartItems,
  removeCartItems,
  resolveCartOption,
  updateCartItemQuantity,
  type CartGroups,
  type CartTotals,
} from '@eum/api/cart';
import { ApiError } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { CartItem, Product } from '@eum/api/types';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';
import { useCheckout } from '@/features/checkout/checkout-context';
import {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  areCartLineSnapshotsEqual,
  areOrderedCartSnapshotsEqual,
  clearPendingOrderedCartCleanup,
  markPendingOrderedCartCleanupComplete,
  readPendingOrderedCartCleanup,
  readPendingOrderedCartCleanupIntent,
  readStoredCart,
  serializeCart,
  subtractOrderedCartLines,
  tryReadStoredCart,
  writePendingOrderedCartCleanup,
  writeStoredCart,
  type OrderedCartLine,
  type StoredCartLine,
} from './cart-storage';

type CartAction =
  | {
      type: 'add';
      product: Product;
      quantity: number;
      optionId: string | null;
      optionLabel: string | null;
    }
  | { type: 'updateQuantity'; cartItemId: string; quantity: number }
  | { type: 'remove'; cartItemIds: ReadonlySet<string> }
  | { type: 'restoreFailed' }
  | { type: 'storageRestoreStarted' }
  | { type: 'storageRestoreCancelled' }
  | { type: 'cleanupIntentLoaded'; orderedLines: OrderedCartLine[] }
  | { type: 'cleanupStarted'; orderedLines: OrderedCartLine[] }
  | { type: 'cleanupFailed'; orderedLines: OrderedCartLine[] }
  | { type: 'cleanupSucceeded' }
  | { type: 'reconcile' }
  | { type: 'replace'; cartItems: CartItem[]; isStorageEvent?: boolean };

interface CartState {
  cartItems: CartItem[];
  /** localStorage 복원이 끝나기 전에는 저장하지 않아 기존 값을 빈 배열로 덮지 않습니다. */
  hasRestored: boolean;
  /** 상품 조회에 실패해 기존 저장값을 보존하고 있는 상태입니다. */
  restoreError: boolean;
  /** 주문 완료 후 최신 저장 장바구니를 다시 불러오는 중입니다. */
  isReconciling: boolean;
  /** 세션에 저장된 주문 정리 의도를 읽었는지 여부입니다. */
  cleanupIntentLoaded: boolean;
  /** localStorage에 반영되지 않은 성공 주문 수량입니다. */
  pendingOrderedLines: OrderedCartLine[];
  /** 주문은 성공했지만 장바구니 정리를 저장하지 못했습니다. */
  orderCleanupError: boolean;
  /** storage-event 복원 중 같은 탭에서 cartItems가 변경되었는지 판별할 기준입니다. */
  storageRestoreBaseItems: CartItem[] | null;
}

function createCartItemId(productId: string, optionId: string | null): string {
  return `cart-${productId}-${optionId ?? 'default'}`;
}

function serializeStoredCartSnapshot(storedLines: readonly StoredCartLine[]): string {
  return serializeCart([...storedLines]);
}

/**
 * 복원 결과(restoredItems)에 복원이 끝나기 전 메모리에서 담은 줄(pendingItems)을 합치는 함수.
 * 같은 상품·옵션 줄은 수량을 더하고, 상품 정보는 방금 조회한 복원 결과를 씁니다.
 */
function mergePendingCartItems(
  restoredItems: readonly CartItem[],
  pendingItems: readonly CartItem[],
): CartItem[] {
  const mergedItems = [...restoredItems];
  for (const pendingItem of pendingItems) {
    const matchedIndex = mergedItems.findIndex((mergedItem) => mergedItem.id === pendingItem.id);
    const matchedItem = matchedIndex >= 0 ? mergedItems[matchedIndex] : undefined;
    if (matchedItem) {
      mergedItems[matchedIndex] = {
        ...matchedItem,
        quantity: clampCartQuantity(matchedItem.quantity + pendingItem.quantity),
      };
    } else {
      mergedItems.push(pendingItem);
    }
  }
  return mergedItems;
}

/** Reducer에서도 복원·주문 정리 중 오래된 callback의 수정을 거부합니다. */
function isCartMutationLocked(state: CartState): boolean {
  return !state.cleanupIntentLoaded || state.isReconciling || state.pendingOrderedLines.length > 0;
}

/** 장바구니 상태 변경을 한곳에서 처리합니다. */
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      if (isCartMutationLocked(state)) return state;
      return {
        ...state,
        cartItems: addProductToCart(
          state.cartItems,
          action.product,
          action.quantity,
          action.optionId,
          action.optionLabel,
          () => createCartItemId(action.product.id, action.optionId),
        ),
      };
    case 'updateQuantity':
      if (isCartMutationLocked(state)) return state;
      return {
        ...state,
        cartItems: updateCartItemQuantity(state.cartItems, action.cartItemId, action.quantity),
      };
    case 'remove':
      if (isCartMutationLocked(state)) return state;
      return { ...state, cartItems: removeCartItems(state.cartItems, action.cartItemIds) };
    case 'restoreFailed':
      return {
        ...state,
        restoreError: true,
        isReconciling: false,
        storageRestoreBaseItems: null,
      };
    case 'storageRestoreStarted':
      return {
        ...state,
        restoreError: false,
        isReconciling: true,
        storageRestoreBaseItems: state.cartItems,
      };
    case 'storageRestoreCancelled':
      return { ...state, isReconciling: false, storageRestoreBaseItems: null };
    case 'cleanupIntentLoaded':
      return {
        ...state,
        cleanupIntentLoaded: true,
        pendingOrderedLines: action.orderedLines,
        orderCleanupError: action.orderedLines.length > 0,
      };
    case 'cleanupStarted':
      return {
        ...state,
        cleanupIntentLoaded: true,
        pendingOrderedLines: action.orderedLines,
        orderCleanupError: false,
        restoreError: false,
        isReconciling: true,
        storageRestoreBaseItems: null,
      };
    case 'cleanupFailed':
      return {
        ...state,
        cleanupIntentLoaded: true,
        pendingOrderedLines: action.orderedLines,
        orderCleanupError: true,
        restoreError: false,
        isReconciling: false,
        storageRestoreBaseItems: null,
      };
    case 'cleanupSucceeded':
      return {
        ...state,
        pendingOrderedLines: [],
        orderCleanupError: false,
      };
    case 'reconcile':
      return {
        ...state,
        // Keep persistence paused until every surviving line has been hydrated from the snapshot.
        cartItems: [],
        hasRestored: false,
        restoreError: false,
        isReconciling: true,
        storageRestoreBaseItems: null,
      };
    case 'replace':
      if (
        action.isStorageEvent &&
        state.storageRestoreBaseItems !== null &&
        state.storageRestoreBaseItems !== state.cartItems
      ) {
        return {
          ...state,
          isReconciling: false,
          storageRestoreBaseItems: null,
        };
      }
      // 첫 복원(또는 복원 실패 뒤 재시도) 전에 담은 줄은 버리지 않고 합칩니다.
      // 복원이 끝난 뒤의 replace(다른 탭의 storage 이벤트)는 저장소가 기준이므로 그대로 바꿉니다.
      return {
        ...state,
        cartItems: state.hasRestored
          ? action.cartItems
          : mergePendingCartItems(action.cartItems, state.cartItems),
        hasRestored: true,
        restoreError: false,
        isReconciling: false,
        storageRestoreBaseItems: null,
      };
  }
}

/** 장바구니 컨텍스트 값 */
export interface CartContextValue {
  cartItems: CartItem[];
  hasRestored: boolean;
  restoreError: boolean;
  orderCleanupError: boolean;
  hasPendingOrderCleanup: boolean;
  cartGroups: CartGroups;
  cartTotals: CartTotals;
  totalQuantity: number;
  isOrderPending: boolean;
  addToCart: (
    product: Product,
    quantity?: number,
    optionId?: string | null,
    optionLabel?: string | null,
  ) => boolean;
  changeQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemIds: ReadonlySet<string>) => void;
  retryRestore: () => void;
  consumeOrderedCartItems: (orderedLines: readonly OrderedCartLine[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** 저장된 상품 ID와 옵션으로 최신 상품을 병렬 조회해 장바구니를 복원합니다. */
export function CartProvider({ children }: { children: ReactNode }) {
  const { isOrderPending: isCheckoutOrderPending, isOrderRequestPending } = useCheckout();
  const [cartState, dispatch] = useReducer(cartReducer, {
    cartItems: [],
    hasRestored: false,
    restoreError: false,
    isReconciling: false,
    cleanupIntentLoaded: false,
    pendingOrderedLines: [],
    orderCleanupError: false,
    storageRestoreBaseItems: null,
  });
  const queryClient = useQueryClient();
  const restoreSequence = useRef(0);
  const lastObservedStorageSnapshot = useRef<string | null>(null);
  const isStorageRestorePendingRef = useRef(false);

  const restoreCart = useCallback(
    async (storedLines: StoredCartLine[], isStorageEvent = false) => {
      const sequence = ++restoreSequence.current;
      const requestedSnapshot = serializeStoredCartSnapshot(storedLines);
      // TODO(real API): 상품 수만큼 단건 조회하지 않도록 ID 목록 일괄 조회 엔드포인트가 생기면 한 번에 가져옵니다.
      const restoredResults = await Promise.all(
        storedLines.map(async (storedLine) => {
          try {
            const product = await queryClient.fetchQuery({
              queryKey: queryKeys.products.detail(storedLine.productId),
              queryFn: async ({ signal }) =>
                (await getShopApi()).products.getById(storedLine.productId, { signal }),
              staleTime: 0,
            });
            // 옵션 문구는 최신 상품 기준으로 갱신합니다. 옵션이 사라졌으면 저장 문구를 남기고,
            // groupCartItems가 '주문할 수 없는 상품'(optionUnavailable)으로 분리합니다.
            const optionResolution = resolveCartOption(product, storedLine.optionId);
            return {
              status: 'restored' as const,
              cartItem: {
                ...storedLine,
                optionLabel: optionResolution.isAvailable
                  ? optionResolution.optionLabel
                  : storedLine.optionLabel,
                id: createCartItemId(storedLine.productId, storedLine.optionId),
                product,
              } satisfies CartItem,
            };
          } catch (restoreFailure: unknown) {
            if (restoreFailure instanceof ApiError && restoreFailure.code === 'NOT_FOUND') {
              return { status: 'missing' as const };
            }
            return { status: 'failed' as const };
          }
        }),
      );
      if (sequence !== restoreSequence.current) return;
      // Provider-local sequence numbers cannot invalidate work started in another tab.
      // Reject this result if shared storage changed while product details were loading.
      const currentStorageRead = tryReadStoredCart();
      if (!currentStorageRead.ok) {
        if (isStorageEvent) isStorageRestorePendingRef.current = false;
        dispatch({ type: 'restoreFailed' });
        return;
      }
      if (serializeStoredCartSnapshot(currentStorageRead.cartLines) !== requestedSnapshot) {
        if (isStorageEvent) {
          isStorageRestorePendingRef.current = false;
          dispatch({ type: 'storageRestoreCancelled' });
        }
        return;
      }
      if (restoredResults.some((result) => result.status === 'failed')) {
        if (isStorageEvent) isStorageRestorePendingRef.current = false;
        dispatch({ type: 'restoreFailed' });
        return;
      }
      lastObservedStorageSnapshot.current = requestedSnapshot;
      if (isStorageEvent) isStorageRestorePendingRef.current = false;
      dispatch({
        type: 'replace',
        isStorageEvent,
        cartItems: restoredResults.flatMap((result) =>
          result.status === 'restored' ? [result.cartItem] : [],
        ),
      });
    },
    [queryClient],
  );

  const restoreCurrentStoredCart = useCallback(
    (isStorageEvent = false) => {
      isStorageRestorePendingRef.current = isStorageEvent;
      if (isStorageEvent) dispatch({ type: 'storageRestoreStarted' });
      const storageRead = tryReadStoredCart();
      if (!storageRead.ok) {
        isStorageRestorePendingRef.current = false;
        dispatch({ type: 'restoreFailed' });
        return;
      }
      void restoreCart(storageRead.cartLines, isStorageEvent);
    },
    [restoreCart],
  );

  const retryPendingOrderCleanup = useCallback(
    (orderedLines: readonly OrderedCartLine[]) => {
      const cleanupLines = orderedLines.map(({ productId, optionId, quantity }) => ({
        productId,
        optionId,
        quantity,
      }));
      if (cleanupLines.length === 0) return;

      // Invalidate reads started before order completion so an older snapshot cannot return later.
      restoreSequence.current += 1;
      isStorageRestorePendingRef.current = false;
      dispatch({ type: 'cleanupStarted', orderedLines: cleanupLines });

      const existingIntent = readPendingOrderedCartCleanupIntent();
      const sameOrderedLines =
        existingIntent !== null &&
        areCartLineSnapshotsEqual(existingIntent.orderedLines, cleanupLines);
      const initialStorageRead = tryReadStoredCart();
      if (!initialStorageRead.ok) {
        if (!sameOrderedLines && !writePendingOrderedCartCleanup(cleanupLines, null, null)) {
          dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
          return;
        }
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        return;
      }

      const storedLines = initialStorageRead.cartLines;
      const cleanupIntent =
        sameOrderedLines &&
        existingIntent.beforeLines !== null &&
        existingIntent.afterLines !== null
          ? existingIntent
          : {
              orderedLines: cleanupLines,
              beforeLines: storedLines.map(({ productId, optionId, quantity }) => ({
                productId,
                optionId,
                quantity,
              })),
              afterLines: subtractOrderedCartLines(storedLines, cleanupLines).map(
                ({ productId, optionId, quantity }) => ({ productId, optionId, quantity }),
              ),
              phase: 'prepared' as const,
            };
      const sameIntent = cleanupIntent === existingIntent;
      if (cleanupIntent.beforeLines === null || cleanupIntent.afterLines === null) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        return;
      }
      if (
        !sameIntent &&
        !writePendingOrderedCartCleanup(
          cleanupIntent.orderedLines,
          storedLines,
          subtractOrderedCartLines(storedLines, cleanupLines),
        )
      ) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        void restoreCart(readStoredCart());
        return;
      }

      const latestStorageRead = tryReadStoredCart();
      if (!latestStorageRead.ok) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        return;
      }
      const latestStoredLines = latestStorageRead.cartLines;
      if (areOrderedCartSnapshotsEqual(latestStoredLines, cleanupIntent.afterLines, cleanupLines)) {
        lastObservedStorageSnapshot.current = serializeStoredCartSnapshot(latestStoredLines);
        markPendingOrderedCartCleanupComplete();
        clearPendingOrderedCartCleanup();
        dispatch({ type: 'cleanupSucceeded' });
        dispatch({ type: 'reconcile' });
        void restoreCart(latestStoredLines);
        return;
      }
      if (
        !areOrderedCartSnapshotsEqual(latestStoredLines, cleanupIntent.beforeLines, cleanupLines)
      ) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        void restoreCart(latestStoredLines);
        return;
      }

      if (cleanupIntent.phase !== 'prepared') {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        void restoreCart(latestStoredLines);
        return;
      }

      if (
        !writePendingOrderedCartCleanup(
          cleanupIntent.orderedLines,
          cleanupIntent.beforeLines,
          cleanupIntent.afterLines,
          'applying',
        )
      ) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        void restoreCart(latestStoredLines);
        return;
      }

      const beforeWriteStorageRead = tryReadStoredCart();
      if (!beforeWriteStorageRead.ok) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        return;
      }
      const beforeWriteLines = beforeWriteStorageRead.cartLines;
      if (areOrderedCartSnapshotsEqual(beforeWriteLines, cleanupIntent.afterLines, cleanupLines)) {
        lastObservedStorageSnapshot.current = serializeStoredCartSnapshot(beforeWriteLines);
        writePendingOrderedCartCleanup(
          cleanupIntent.orderedLines,
          cleanupIntent.beforeLines,
          cleanupIntent.afterLines,
          'applied',
        );
        markPendingOrderedCartCleanupComplete();
        clearPendingOrderedCartCleanup();
        dispatch({ type: 'cleanupSucceeded' });
        dispatch({ type: 'reconcile' });
        void restoreCart(beforeWriteLines);
        return;
      }
      if (
        !areOrderedCartSnapshotsEqual(beforeWriteLines, cleanupIntent.beforeLines, cleanupLines)
      ) {
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        void restoreCart(beforeWriteLines);
        return;
      }

      const remainingLines = subtractOrderedCartLines(beforeWriteLines, cleanupLines);
      if (!writeStoredCart(remainingLines)) {
        const failedWriteStorageRead = tryReadStoredCart();
        if (
          failedWriteStorageRead.ok &&
          areOrderedCartSnapshotsEqual(
            failedWriteStorageRead.cartLines,
            cleanupIntent.beforeLines,
            cleanupLines,
          )
        ) {
          writePendingOrderedCartCleanup(
            cleanupIntent.orderedLines,
            cleanupIntent.beforeLines,
            cleanupIntent.afterLines,
            'prepared',
          );
        }
        dispatch({ type: 'cleanupFailed', orderedLines: cleanupLines });
        void restoreCart(
          failedWriteStorageRead.ok ? failedWriteStorageRead.cartLines : beforeWriteLines,
        );
        return;
      }

      lastObservedStorageSnapshot.current = serializeStoredCartSnapshot(remainingLines);
      writePendingOrderedCartCleanup(
        cleanupIntent.orderedLines,
        cleanupIntent.beforeLines,
        cleanupIntent.afterLines,
        'applied',
      );
      markPendingOrderedCartCleanupComplete();
      clearPendingOrderedCartCleanup();
      dispatch({ type: 'cleanupSucceeded' });
      dispatch({ type: 'reconcile' });
      void restoreCart(remainingLines);
    },
    [restoreCart],
  );

  const retryRestore = useCallback(() => {
    const pendingLines =
      cartState.pendingOrderedLines.length > 0
        ? cartState.pendingOrderedLines
        : readPendingOrderedCartCleanup();
    if (pendingLines.length > 0) {
      retryPendingOrderCleanup(pendingLines);
      return;
    }
    restoreCurrentStoredCart();
  }, [cartState.pendingOrderedLines, restoreCurrentStoredCart, retryPendingOrderCleanup]);

  const consumeOrderedCartItems = useCallback(
    (orderedLines: readonly OrderedCartLine[]) => {
      if (cartState.pendingOrderedLines.length > 0) return;
      retryPendingOrderCleanup(orderedLines);
    },
    [cartState.pendingOrderedLines, retryPendingOrderCleanup],
  );

  useEffect(() => {
    const pendingOrderedLines = readPendingOrderedCartCleanup();
    dispatch({ type: 'cleanupIntentLoaded', orderedLines: pendingOrderedLines });
    if (pendingOrderedLines.length > 0) {
      retryPendingOrderCleanup(pendingOrderedLines);
    } else {
      restoreCurrentStoredCart();
    }
    const handleStorage = (storageEvent: StorageEvent) => {
      if (
        storageEvent.key !== null &&
        storageEvent.key !== CART_STORAGE_KEY &&
        storageEvent.key !== LEGACY_CART_STORAGE_KEY
      ) {
        return;
      }
      // A queued storage event may describe an older write than the value currently stored.
      restoreCurrentStoredCart(true);
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      restoreSequence.current += 1;
      window.removeEventListener('storage', handleStorage);
    };
  }, [restoreCurrentStoredCart, retryPendingOrderCleanup]);

  useEffect(() => {
    if (
      !cartState.hasRestored ||
      cartState.restoreError ||
      cartState.isReconciling ||
      cartState.pendingOrderedLines.length > 0
    ) {
      return;
    }
    const currentStorageRead = tryReadStoredCart();
    if (!currentStorageRead.ok) return;
    const currentStorageSnapshot = serializeStoredCartSnapshot(currentStorageRead.cartLines);
    if (
      lastObservedStorageSnapshot.current !== null &&
      currentStorageSnapshot !== lastObservedStorageSnapshot.current
    ) {
      // Do not let a hydration effect clobber a write that another tab made after our read.
      return;
    }
    const cartLines = cartState.cartItems.map(({ productId, quantity, optionId, optionLabel }) => ({
      productId,
      quantity,
      optionId,
      optionLabel,
    }));
    if (writeStoredCart(cartLines)) {
      lastObservedStorageSnapshot.current = serializeStoredCartSnapshot(cartLines);
    }
  }, [
    cartState.cartItems,
    cartState.hasRestored,
    cartState.isReconciling,
    cartState.pendingOrderedLines,
    cartState.restoreError,
  ]);

  const contextValue = useMemo<CartContextValue>(() => {
    const {
      cartItems,
      hasRestored,
      restoreError,
      isReconciling,
      cleanupIntentLoaded,
      pendingOrderedLines,
      orderCleanupError,
    } = cartState;
    const hasPendingOrderCleanup = pendingOrderedLines.length > 0;
    const isCleanupIntentLoading = !cleanupIntentLoaded;
    const isCartOperationPending =
      isCheckoutOrderPending || isReconciling || hasPendingOrderCleanup || isCleanupIntentLoading;
    return {
      cartItems,
      hasRestored,
      restoreError,
      orderCleanupError,
      hasPendingOrderCleanup,
      cartGroups: groupCartItems(cartItems),
      cartTotals: calculateCartTotals(cartItems),
      totalQuantity: cartItems.reduce(
        (quantitySum, cartItem) => quantitySum + cartItem.quantity,
        0,
      ),
      isOrderPending: isCartOperationPending,
      addToCart: (product, quantity = 1, optionId = null, optionLabel = null) => {
        if (
          isStorageRestorePendingRef.current ||
          isOrderRequestPending() ||
          isCartOperationPending
        ) {
          return false;
        }
        dispatch({ type: 'add', product, quantity, optionId, optionLabel });
        return true;
      },
      changeQuantity: (cartItemId, quantity) => {
        if (!isStorageRestorePendingRef.current && !isCartOperationPending) {
          dispatch({ type: 'updateQuantity', cartItemId, quantity });
        }
      },
      removeFromCart: (cartItemIds) => {
        if (!isStorageRestorePendingRef.current && !isCartOperationPending) {
          dispatch({ type: 'remove', cartItemIds });
        }
      },
      retryRestore,
      consumeOrderedCartItems,
    };
  }, [
    cartState,
    consumeOrderedCartItems,
    isCheckoutOrderPending,
    isOrderRequestPending,
    retryRestore,
  ]);

  return <CartContext value={contextValue}>{children}</CartContext>;
}

/** CartProvider 안에서 현재 장바구니 값과 변경 함수를 가져옵니다. */
export function useCart(): CartContextValue {
  const cartContext = use(CartContext);
  if (!cartContext) throw new Error('useCart는 CartProvider 안에서만 쓸 수 있습니다.');
  return cartContext;
}
