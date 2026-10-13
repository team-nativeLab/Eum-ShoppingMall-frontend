'use client';

import {
  addProductToCart,
  calculateCartTotals,
  groupCartItems,
  removeCartItems,
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
import {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  parseStoredCart,
  readStoredCart,
  writeStoredCart,
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
  | { type: 'replace'; cartItems: CartItem[] };

interface CartState {
  cartItems: CartItem[];
  /** localStorage 복원이 끝나기 전에는 저장하지 않아 기존 값을 빈 배열로 덮지 않습니다. */
  hasRestored: boolean;
  /** 상품 조회에 실패해 기존 저장값을 보존하고 있는 상태입니다. */
  restoreError: boolean;
}

function createCartItemId(productId: string, optionId: string | null): string {
  return `cart-${productId}-${optionId ?? 'default'}`;
}

/** 장바구니 상태 변경을 한곳에서 처리합니다. */
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
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
      return {
        ...state,
        cartItems: updateCartItemQuantity(state.cartItems, action.cartItemId, action.quantity),
      };
    case 'remove':
      return { ...state, cartItems: removeCartItems(state.cartItems, action.cartItemIds) };
    case 'restoreFailed':
      return { ...state, restoreError: true };
    case 'replace':
      return { cartItems: action.cartItems, hasRestored: true, restoreError: false };
  }
}

/** 장바구니 컨텍스트 값 */
export interface CartContextValue {
  cartItems: CartItem[];
  hasRestored: boolean;
  restoreError: boolean;
  cartGroups: CartGroups;
  cartTotals: CartTotals;
  totalQuantity: number;
  addToCart: (
    product: Product,
    quantity?: number,
    optionId?: string | null,
    optionLabel?: string | null,
  ) => void;
  changeQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemIds: ReadonlySet<string>) => void;
  retryRestore: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** 저장된 상품 ID와 옵션으로 최신 상품을 병렬 조회해 장바구니를 복원합니다. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cartState, dispatch] = useReducer(cartReducer, {
    cartItems: [],
    hasRestored: false,
    restoreError: false,
  });
  const queryClient = useQueryClient();
  const restoreSequence = useRef(0);

  const restoreCart = useCallback(
    async (storedLines: StoredCartLine[]) => {
      const sequence = ++restoreSequence.current;
      const restoredResults = await Promise.all(
        storedLines.map(async (storedLine) => {
          try {
            const product = await queryClient.fetchQuery({
              queryKey: queryKeys.products.detail(storedLine.productId),
              queryFn: async ({ signal }) =>
                (await getShopApi()).products.getById(storedLine.productId, { signal }),
              staleTime: 0,
            });
            return {
              status: 'restored' as const,
              cartItem: {
                ...storedLine,
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
      if (restoredResults.some((result) => result.status === 'failed')) {
        dispatch({ type: 'restoreFailed' });
        return;
      }
      dispatch({
        type: 'replace',
        cartItems: restoredResults.flatMap((result) =>
          result.status === 'restored' ? [result.cartItem] : [],
        ),
      });
    },
    [queryClient],
  );

  const retryRestore = useCallback(() => {
    void restoreCart(readStoredCart());
  }, [restoreCart]);

  useEffect(() => {
    void restoreCart(readStoredCart());
    const handleStorage = (storageEvent: StorageEvent) => {
      if (
        storageEvent.key !== null &&
        storageEvent.key !== CART_STORAGE_KEY &&
        storageEvent.key !== LEGACY_CART_STORAGE_KEY
      ) {
        return;
      }
      void restoreCart(parseStoredCart(storageEvent.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      restoreSequence.current += 1;
      window.removeEventListener('storage', handleStorage);
    };
  }, [restoreCart]);

  useEffect(() => {
    if (!cartState.hasRestored) return;
    writeStoredCart(
      cartState.cartItems.map(({ productId, quantity, optionId, optionLabel }) => ({
        productId,
        quantity,
        optionId,
        optionLabel,
      })),
    );
  }, [cartState.cartItems, cartState.hasRestored]);

  const contextValue = useMemo<CartContextValue>(() => {
    const { cartItems, hasRestored, restoreError } = cartState;
    return {
      cartItems,
      hasRestored,
      restoreError,
      cartGroups: groupCartItems(cartItems),
      cartTotals: calculateCartTotals(cartItems),
      totalQuantity: cartItems.reduce(
        (quantitySum, cartItem) => quantitySum + cartItem.quantity,
        0,
      ),
      addToCart: (product, quantity = 1, optionId = null, optionLabel = null) =>
        dispatch({ type: 'add', product, quantity, optionId, optionLabel }),
      changeQuantity: (cartItemId, quantity) =>
        dispatch({ type: 'updateQuantity', cartItemId, quantity }),
      removeFromCart: (cartItemIds) => dispatch({ type: 'remove', cartItemIds }),
      retryRestore,
    };
  }, [cartState, retryRestore]);

  return <CartContext value={contextValue}>{children}</CartContext>;
}

/** CartProvider 안에서 현재 장바구니 값과 변경 함수를 가져옵니다. */
export function useCart(): CartContextValue {
  const cartContext = use(CartContext);
  if (!cartContext) throw new Error('useCart는 CartProvider 안에서만 쓸 수 있습니다.');
  return cartContext;
}
