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
import type { CartItem, Product } from '@eum/api/types';
import { createContext, use, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { CART_STORAGE_KEY, parseStoredCart, readStoredCart, writeStoredCart } from './cart-storage';

type CartAction =
  | { type: 'add'; product: Product; quantity: number }
  | { type: 'updateQuantity'; cartItemId: string; quantity: number }
  | { type: 'remove'; cartItemIds: ReadonlySet<string> }
  | { type: 'replace'; cartItems: CartItem[] };

interface CartState {
  cartItems: CartItem[];
  /** localStorage 복원이 끝났는지. 끝나기 전에는 저장하지 않아 기존 값을 빈 배열로 덮지 않습니다. */
  hasRestored: boolean;
}

// 한 상품은 장바구니에 한 줄이므로 상품 id로 항목 id를 만듭니다.
const createCartItemIdFor = (product: Product) => () => `cart-${product.id}`;

// 장바구니 상태 변경을 한곳에서 처리하는 reducer. 계산은 @eum/api/cart 순수 함수에 맡깁니다.
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return {
        ...state,
        cartItems: addProductToCart(
          state.cartItems,
          action.product,
          action.quantity,
          createCartItemIdFor(action.product),
        ),
      };
    case 'updateQuantity':
      return {
        ...state,
        cartItems: updateCartItemQuantity(state.cartItems, action.cartItemId, action.quantity),
      };
    case 'remove':
      return { ...state, cartItems: removeCartItems(state.cartItems, action.cartItemIds) };
    case 'replace':
      return { cartItems: action.cartItems, hasRestored: true };
  }
}

/**
 * 장바구니 컨텍스트 값.
 * 가격·금액 표시 여부는 담을 때의 클라이언트 스냅샷입니다. 화면 표시용일 뿐이며,
 * 주문 금액은 주문 시점에 서버가 최신 상품 정보로 다시 계산한다는 전제입니다(클라이언트 합계를 신뢰하지 않음).
 */
export interface CartContextValue {
  cartItems: CartItem[];
  /** 저장된 장바구니 복원이 끝났는지. false인 동안은 빈 장바구니 안내 대신 로딩을 보여 줍니다. */
  hasRestored: boolean;
  /** 주문 가능 / '주문할 수 없는 상품' 그룹(파생값) */
  cartGroups: CartGroups;
  /** 주문 가능 항목 전체 기준 합계(파생값). 선택 합계는 화면에서 calculateCartTotals로 구합니다. */
  cartTotals: CartTotals;
  totalQuantity: number;
  addToCart: (product: Product, quantity?: number) => void;
  changeQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemIds: ReadonlySet<string>) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * 장바구니 상태 provider(목 단계: 브라우저 localStorage에 보관).
 * - 서버 렌더링과 첫 클라이언트 렌더링은 빈 장바구니로 같게 그리고, 마운트 후 effect에서 복원합니다(hydration 불일치 방지).
 * - 다른 탭에서 바뀌면 storage 이벤트로 맞춥니다.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cartState, dispatch] = useReducer(cartReducer, { cartItems: [], hasRestored: false });

  // 마운트 후 저장된 장바구니를 복원하고, 다른 탭의 변경을 구독합니다.
  useEffect(() => {
    dispatch({ type: 'replace', cartItems: readStoredCart() });
    const handleStorage = (storageEvent: StorageEvent) => {
      // key가 null이면 다른 탭에서 localStorage.clear()를 부른 것이라 장바구니도 비웁니다.
      if (storageEvent.key !== null && storageEvent.key !== CART_STORAGE_KEY) return;
      dispatch({ type: 'replace', cartItems: parseStoredCart(storageEvent.newValue) });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // 복원이 끝난 뒤의 변경만 저장합니다.
  useEffect(() => {
    if (!cartState.hasRestored) return;
    writeStoredCart(cartState.cartItems);
  }, [cartState]);

  const contextValue = useMemo<CartContextValue>(() => {
    const { cartItems, hasRestored } = cartState;
    return {
      cartItems,
      hasRestored,
      cartGroups: groupCartItems(cartItems),
      cartTotals: calculateCartTotals(cartItems),
      totalQuantity: cartItems.reduce(
        (quantitySum, cartItem) => quantitySum + cartItem.quantity,
        0,
      ),
      addToCart: (product, quantity = 1) => dispatch({ type: 'add', product, quantity }),
      changeQuantity: (cartItemId, quantity) =>
        dispatch({ type: 'updateQuantity', cartItemId, quantity }),
      removeFromCart: (cartItemIds) => dispatch({ type: 'remove', cartItemIds }),
    };
  }, [cartState]);

  return <CartContext value={contextValue}>{children}</CartContext>;
}

/** 장바구니 컨텍스트를 읽는 훅. CartProvider 밖에서 부르면 오류입니다. */
export function useCart(): CartContextValue {
  const cartContext = use(CartContext);
  if (!cartContext) {
    throw new Error('useCart는 CartProvider 안에서만 쓸 수 있습니다.');
  }
  return cartContext;
}
