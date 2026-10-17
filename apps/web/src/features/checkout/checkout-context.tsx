'use client';

import type { Address, OrderReceipt, PaymentMethod } from '@eum/api/types';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CHECKOUT_SELECTION_STORAGE_KEY,
  parseCheckoutSelection,
  serializeCheckoutSelection,
  type DirectCheckoutLine,
  type CheckoutSelectionMode,
  type CheckoutSelectionSource,
  type CheckoutSelectionSnapshot,
} from './checkout-selection-storage';

export interface CompletedCheckout extends OrderReceipt {
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  shippingAddress: Address;
}

export interface CheckoutState {
  cartItemIds: string[];
  directLines: DirectCheckoutLine[];
  selectionMode: CheckoutSelectionMode;
  selectionSource: CheckoutSelectionSource;
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
  checkoutGeneration: number;
  isOrderPending: boolean;
  isOrderRequestPending: () => boolean;
  beginOrderRequest: (expectedGeneration: number) => number | null;
  isOrderRequestCurrent: (requestId: number, generation: number) => boolean;
  finishOrderRequest: (requestId: number) => void;
  setCartSelection: (cartItemIds: readonly string[]) => boolean;
  beginCheckout: (cartItemIds: readonly string[]) => boolean;
  beginDirectCheckout: (directLines: readonly DirectCheckoutLine[]) => boolean;
  setShipping: (shippingAddress: Address, deliveryRequest: string) => boolean;
  setPayment: (
    paymentMethod: PaymentMethod,
    couponId: string | null,
    pointsToUse: number,
    orderRequestId?: number,
  ) => number;
  completeCheckout: (
    receipt: CompletedCheckout,
    expectedGeneration: number,
    requestId: number,
  ) => boolean;
  resetCheckout: () => boolean;
}

const EMPTY_CHECKOUT_STATE: CheckoutState = {
  cartItemIds: [],
  directLines: [],
  selectionMode: 'defaultAll',
  selectionSource: 'cart',
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
  const [checkoutGeneration, setCheckoutGeneration] = useState(0);
  const [activeOrderRequestId, setActiveOrderRequestId] = useState<number | null>(null);
  const stateRef = useRef(state);
  const checkoutGenerationRef = useRef(0);
  const activeOrderRequestIdRef = useRef<number | null>(null);
  const orderRequestSequenceRef = useRef(0);

  const commitState = useCallback((nextState: CheckoutState, selectionChanged = false) => {
    stateRef.current = nextState;
    setState(nextState);
    if (selectionChanged) {
      checkoutGenerationRef.current += 1;
      setCheckoutGeneration(checkoutGenerationRef.current);
    }
  }, []);

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
      const currentState = stateRef.current;
      if (!currentState.checkoutStarted && checkoutGenerationRef.current === 0) {
        commitState({ ...currentState, ...restoredSelection });
      }
      setIsSelectionReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, [commitState]);

  useEffect(() => {
    if (!isSelectionReady) return;
    storeCheckoutSelection({
      cartItemIds: state.cartItemIds,
      directLines: state.directLines,
      selectionMode: state.selectionMode,
      selectionSource: state.selectionSource,
      checkoutStarted: state.checkoutStarted,
    });
  }, [
    isSelectionReady,
    state.cartItemIds,
    state.directLines,
    state.selectionMode,
    state.selectionSource,
    state.checkoutStarted,
  ]);

  const value = useMemo<CheckoutContextValue>(
    () => ({
      ...state,
      isSelectionReady,
      checkoutGeneration,
      isOrderPending: activeOrderRequestId !== null,
      isOrderRequestPending: () => activeOrderRequestIdRef.current !== null,
      beginOrderRequest: (expectedGeneration) => {
        if (
          activeOrderRequestIdRef.current !== null ||
          checkoutGenerationRef.current !== expectedGeneration
        ) {
          return null;
        }
        orderRequestSequenceRef.current += 1;
        activeOrderRequestIdRef.current = orderRequestSequenceRef.current;
        setActiveOrderRequestId(orderRequestSequenceRef.current);
        return orderRequestSequenceRef.current;
      },
      isOrderRequestCurrent: (requestId, generation) =>
        activeOrderRequestIdRef.current === requestId &&
        checkoutGenerationRef.current === generation,
      finishOrderRequest: (requestId) => {
        if (activeOrderRequestIdRef.current !== requestId) return;
        activeOrderRequestIdRef.current = null;
        setActiveOrderRequestId(null);
      },
      setCartSelection: (cartItemIds) => {
        if (activeOrderRequestIdRef.current !== null) return false;
        const nextCartItemIds = [...new Set(cartItemIds)];
        const nextSelection: CheckoutSelectionSnapshot = {
          cartItemIds: nextCartItemIds,
          directLines: [],
          selectionMode: 'explicit',
          selectionSource: 'cart',
          checkoutStarted: false,
        };
        storeCheckoutSelection(nextSelection);
        commitState(
          {
            ...stateRef.current,
            cartItemIds: nextCartItemIds,
            directLines: [],
            selectionMode: 'explicit',
            selectionSource: 'cart',
            checkoutStarted: false,
          },
          true,
        );
        return true;
      },
      beginCheckout: (cartItemIds) => {
        if (activeOrderRequestIdRef.current !== null) return false;
        const nextCartItemIds = [...new Set(cartItemIds)];
        const nextSelection: CheckoutSelectionSnapshot = {
          cartItemIds: nextCartItemIds,
          directLines: [],
          selectionMode: 'explicit',
          selectionSource: 'cart',
          checkoutStarted: true,
        };
        storeCheckoutSelection(nextSelection);
        const currentState = stateRef.current;
        commitState(
          {
            ...EMPTY_CHECKOUT_STATE,
            ...nextSelection,
            paymentMethod: currentState.paymentMethod,
          },
          true,
        );
        return true;
      },
      beginDirectCheckout: (directLines) => {
        if (activeOrderRequestIdRef.current !== null) return false;
        const nextDirectLines = directLines.map((line) => ({ ...line }));
        const currentState = stateRef.current;
        let preservedCartSelection = {
          cartItemIds: currentState.cartItemIds,
          selectionMode: currentState.selectionMode,
        };
        if (!isSelectionReady && checkoutGenerationRef.current === 0) {
          try {
            const storedSelection = parseCheckoutSelection(
              window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY),
            );
            preservedCartSelection = {
              cartItemIds: storedSelection.cartItemIds,
              selectionMode: storedSelection.selectionMode,
            };
          } catch {
            // 저장소가 막힌 경우 현재 탭의 checkout 상태로 cart 선택을 보존합니다.
          }
        }
        const nextSelection: CheckoutSelectionSnapshot = {
          cartItemIds: preservedCartSelection.cartItemIds,
          directLines: nextDirectLines,
          selectionMode: preservedCartSelection.selectionMode,
          selectionSource: 'direct',
          checkoutStarted: true,
        };
        storeCheckoutSelection(nextSelection);
        const cartSelection = currentState.checkoutStarted
          ? {
              cartItemIds: currentState.cartItemIds,
              selectionMode: currentState.selectionMode,
            }
          : preservedCartSelection;
        commitState(
          {
            ...EMPTY_CHECKOUT_STATE,
            ...cartSelection,
            directLines: nextDirectLines,
            selectionSource: 'direct',
            checkoutStarted: true,
            paymentMethod: currentState.paymentMethod,
          },
          true,
        );
        return true;
      },
      setShipping: (shippingAddress, deliveryRequest) => {
        if (activeOrderRequestIdRef.current !== null) return false;
        commitState(
          {
            ...stateRef.current,
            shippingAddress,
            deliveryRequest,
            receipt: null,
          },
          true,
        );
        return true;
      },
      setPayment: (paymentMethod, couponId, pointsToUse, orderRequestId) => {
        if (
          activeOrderRequestIdRef.current !== null &&
          activeOrderRequestIdRef.current !== orderRequestId
        ) {
          return checkoutGenerationRef.current;
        }
        commitState(
          {
            ...stateRef.current,
            paymentMethod,
            couponId,
            pointsToUse,
          },
          true,
        );
        return checkoutGenerationRef.current;
      },
      completeCheckout: (receipt, expectedGeneration, requestId) => {
        if (
          activeOrderRequestIdRef.current !== requestId ||
          checkoutGenerationRef.current !== expectedGeneration
        ) {
          return false;
        }
        const currentState = stateRef.current;
        const nextSelection: CheckoutSelectionSnapshot =
          currentState.selectionSource === 'direct'
            ? {
                cartItemIds: currentState.cartItemIds,
                directLines: [],
                selectionMode: currentState.selectionMode,
                selectionSource: 'cart',
                checkoutStarted: false,
              }
            : {
                cartItemIds: [],
                directLines: [],
                selectionMode: 'explicit',
                selectionSource: 'cart',
                checkoutStarted: true,
              };
        storeCheckoutSelection(nextSelection);
        commitState(
          {
            ...currentState,
            ...nextSelection,
            receipt,
          },
          true,
        );
        return true;
      },
      resetCheckout: () => {
        if (activeOrderRequestIdRef.current !== null && stateRef.current.receipt === null) {
          return false;
        }
        storeCheckoutSelection({
          cartItemIds: [],
          directLines: [],
          selectionMode: 'defaultAll',
          selectionSource: 'cart',
          checkoutStarted: false,
        });
        commitState(EMPTY_CHECKOUT_STATE, true);
        return true;
      },
    }),
    [activeOrderRequestId, checkoutGeneration, commitState, isSelectionReady, state],
  );

  return <CheckoutContext value={value}>{children}</CheckoutContext>;
}

export function useCheckout(): CheckoutContextValue {
  const value = use(CheckoutContext);
  if (!value) throw new Error('useCheckout는 CheckoutProvider 안에서만 씁니다.');
  return value;
}
