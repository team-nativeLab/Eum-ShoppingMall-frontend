'use client';

import type { Address, OrderReceipt, PaymentMethod } from '@eum/api/types';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CHECKOUT_SELECTION_STORAGE_KEY,
  parseCheckoutSelection,
  serializeCheckoutSelection,
  type CheckoutSelectionMode,
  type CheckoutSelectionSnapshot,
} from './checkout-selection-storage';

export interface CompletedCheckout extends OrderReceipt {
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  shippingAddress: Address;
}

export interface CheckoutState {
  cartItemIds: string[];
  selectionMode: CheckoutSelectionMode;
  checkoutStarted: boolean;
  shippingAddress: Address | null;
  deliveryRequest: string;
  paymentMethod: PaymentMethod;
  couponId: string | null;
  pointsToUse: number;
  receipt: CompletedCheckout | null;
}

interface CheckoutContextValue extends CheckoutState {
  isSelectionReady: boolean;
  setCartSelection: (cartItemIds: readonly string[]) => void;
  beginCheckout: (cartItemIds: readonly string[]) => void;
  setShipping: (shippingAddress: Address, deliveryRequest: string) => void;
  setPayment: (paymentMethod: PaymentMethod, couponId: string | null, pointsToUse: number) => void;
  completeCheckout: (receipt: CompletedCheckout) => void;
  resetCheckout: () => void;
}

const EMPTY_CHECKOUT_STATE: CheckoutState = {
  cartItemIds: [],
  selectionMode: 'defaultAll',
  checkoutStarted: false,
  shippingAddress: null,
  deliveryRequest: '',
  paymentMethod: 'creditCard',
  couponId: null,
  pointsToUse: 0,
  receipt: null,
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

function storeCheckoutSelection(selection: CheckoutSelectionSnapshot): void {
  const serializedSelection = serializeCheckoutSelection(selection);
  try {
    if (serializedSelection === null) {
      window.sessionStorage.removeItem(CHECKOUT_SELECTION_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(CHECKOUT_SELECTION_STORAGE_KEY, serializedSelection);
    }
  } catch {
    // 저장소가 차단된 경우 현재 탭의 React 상태로 선택을 유지합니다.
  }
}

/** 주소·연락처·결제 입력은 브라우저 저장소에 쓰지 않고 현재 앱 메모리에만 둡니다. */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CheckoutState>(EMPTY_CHECKOUT_STATE);
  const [isSelectionReady, setIsSelectionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void Promise.resolve().then(() => {
      let storedSelection: string | null;
      try {
        storedSelection = window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY);
      } catch {
        storedSelection = '{}';
      }
      if (!isMounted) return;
      const restoredSelection = parseCheckoutSelection(storedSelection);
      setState((currentState) => ({ ...currentState, ...restoredSelection }));
      setIsSelectionReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSelectionReady) return;
    storeCheckoutSelection({
      cartItemIds: state.cartItemIds,
      selectionMode: state.selectionMode,
      checkoutStarted: state.checkoutStarted,
    });
  }, [isSelectionReady, state.cartItemIds, state.selectionMode, state.checkoutStarted]);

  const value = useMemo<CheckoutContextValue>(
    () => ({
      ...state,
      isSelectionReady,
      setCartSelection: (cartItemIds) => {
        const nextCartItemIds = [...new Set(cartItemIds)];
        storeCheckoutSelection({
          cartItemIds: nextCartItemIds,
          selectionMode: 'explicit',
          checkoutStarted: state.checkoutStarted,
        });
        setState((currentState) => ({
          ...currentState,
          cartItemIds: nextCartItemIds,
          selectionMode: 'explicit',
        }));
      },
      beginCheckout: (cartItemIds) => {
        const nextCartItemIds = [...new Set(cartItemIds)];
        storeCheckoutSelection({
          cartItemIds: nextCartItemIds,
          selectionMode: 'explicit',
          checkoutStarted: true,
        });
        setState((currentState) => ({
          ...EMPTY_CHECKOUT_STATE,
          cartItemIds: nextCartItemIds,
          selectionMode: 'explicit',
          checkoutStarted: true,
          paymentMethod: currentState.paymentMethod,
        }));
      },
      setShipping: (shippingAddress, deliveryRequest) =>
        setState((currentState) => ({
          ...currentState,
          shippingAddress,
          deliveryRequest,
          receipt: null,
        })),
      setPayment: (paymentMethod, couponId, pointsToUse) =>
        setState((currentState) => ({
          ...currentState,
          paymentMethod,
          couponId,
          pointsToUse,
        })),
      completeCheckout: (receipt) =>
        setState((currentState) => ({
          ...currentState,
          cartItemIds: [],
          selectionMode: 'explicit',
          checkoutStarted: true,
          receipt,
        })),
      resetCheckout: () => {
        storeCheckoutSelection({
          cartItemIds: [],
          selectionMode: 'defaultAll',
          checkoutStarted: false,
        });
        setState(EMPTY_CHECKOUT_STATE);
      },
    }),
    [isSelectionReady, state],
  );

  return <CheckoutContext value={value}>{children}</CheckoutContext>;
}

export function useCheckout(): CheckoutContextValue {
  const value = use(CheckoutContext);
  if (!value) throw new Error('useCheckout는 CheckoutProvider 안에서만 씁니다.');
  return value;
}
