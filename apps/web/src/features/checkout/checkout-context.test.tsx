import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CheckoutProvider, useCheckout } from './checkout-context';
import { CART_STORAGE_KEY } from '@/features/cart/cart-storage';
import {
  CHECKOUT_SELECTION_STORAGE_KEY,
  parseCheckoutSelection,
} from './checkout-selection-storage';

function CheckoutSelectionProbe() {
  const checkout = useCheckout();
  const savedOrderRequest = useRef<{ generation: number; requestId: number } | null>(null);
  const testReceipt = {
    orderNumber: 'test-order',
    productTotal: 0,
    discountTotal: 0,
    shippingFee: 0,
    pointsUsed: 0,
    paymentTotal: 0,
    paymentMethod: 'creditCard' as const,
    paymentMethodLabel: '카드',
    shippingAddress: {
      id: 'address-test',
      label: '테스트 주소',
      recipientName: '받는 사람',
      phone: '01000000000',
      postalCode: '00000',
      address1: '테스트 주소',
      address2: '',
      isDefault: false,
    },
  };
  return (
    <div>
      <output data-testid="selection">
        {JSON.stringify({
          ready: checkout.isSelectionReady,
          source: checkout.selectionSource,
          cartItemIds: checkout.cartItemIds,
          selectionMode: checkout.selectionMode,
          checkoutStarted: checkout.checkoutStarted,
          directLines: checkout.directLines,
          receipt: checkout.receipt?.orderNumber ?? null,
          shippingAddress: checkout.shippingAddress?.address1 ?? null,
          paymentMethod: checkout.paymentMethod,
          orderPending: checkout.isOrderPending,
        })}
      </output>
      <button
        type="button"
        onClick={() =>
          checkout.beginDirectCheckout([
            { productId: 'product-a', optionId: 'size:m', quantity: 2 },
            { productId: 'product-a', optionId: 'size:l', quantity: 1 },
          ])
        }
      >
        바로 구매 시작
      </button>
      <button type="button" onClick={() => checkout.beginCheckout(['cart-product-a'])}>
        장바구니 주문 시작
      </button>
      <button type="button" onClick={() => checkout.setCartSelection(['cart-new-selection'])}>
        장바구니 선택 변경
      </button>
      <button
        type="button"
        onClick={() => {
          const generation = checkout.checkoutGeneration;
          const requestId = checkout.beginOrderRequest(generation);
          if (requestId !== null) savedOrderRequest.current = { generation, requestId };
        }}
      >
        주문 요청 시점 저장
      </button>
      <button
        type="button"
        onClick={() => {
          if (savedOrderRequest.current !== null) {
            const didComplete = checkout.completeCheckout(
              testReceipt,
              savedOrderRequest.current.generation,
              savedOrderRequest.current.requestId,
            );
            if (didComplete) {
              checkout.finishOrderRequest(savedOrderRequest.current.requestId);
            }
          }
        }}
      >
        저장된 주문 성공 처리
      </button>
      <button
        type="button"
        onClick={() => {
          checkout.setCartSelection(['cart-new-selection']);
          checkout.beginCheckout(['cart-new-selection']);
          checkout.beginDirectCheckout([{ productId: 'product-b', optionId: null, quantity: 1 }]);
          checkout.setShipping(testReceipt.shippingAddress, 'door');
          checkout.setPayment('bankTransfer', 'new-coupon', 100);
        }}
      >
        주문 중 새 주문 정보 변경 시도
      </button>
      <button type="button" onClick={() => checkout.setPayment('creditCard', null, 0)}>
        주문 실패 처리
      </button>
      <button
        type="button"
        onClick={() => {
          const requestId = checkout.beginOrderRequest(checkout.checkoutGeneration);
          if (requestId === null) return;
          const generation = checkout.setPayment(
            checkout.paymentMethod,
            checkout.couponId,
            checkout.pointsToUse,
            requestId,
          );
          checkout.completeCheckout(testReceipt, generation, requestId);
          checkout.finishOrderRequest(requestId);
        }}
      >
        주문 성공 처리
      </button>
    </div>
  );
}

function renderCheckout() {
  return render(
    <CheckoutProvider>
      <CheckoutSelectionProbe />
    </CheckoutProvider>,
  );
}

describe('CheckoutProvider direct selection', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.setItem(CART_STORAGE_KEY, 'cart-snapshot');
    window.sessionStorage.setItem(
      CHECKOUT_SELECTION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cartItemIds: ['cart-old-selection'],
        selectionMode: 'explicit',
        checkoutStarted: true,
      }),
    );
  });

  it('preserves the prior cart selection through direct checkout and restores it after success', async () => {
    const user = userEvent.setup();
    let checkoutView = renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));
    expect(screen.getByTestId('selection')).toHaveTextContent('cart-old-selection');

    await user.click(screen.getByRole('button', { name: '바로 구매 시작' }));
    const storedDirectSelection = JSON.parse(
      window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY) ?? 'null',
    );
    expect(storedDirectSelection).toEqual({
      version: 2,
      cartItemIds: ['cart-old-selection'],
      directLines: [
        { productId: 'product-a', optionId: 'size:m', quantity: 2 },
        { productId: 'product-a', optionId: 'size:l', quantity: 1 },
      ],
      selectionMode: 'explicit',
      selectionSource: 'direct',
      checkoutStarted: true,
    });
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe('cart-snapshot');

    checkoutView.unmount();
    checkoutView = renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));
    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"direct"');
    expect(screen.getByTestId('selection')).toHaveTextContent('size:l');

    await user.click(screen.getByRole('button', { name: '주문 실패 처리' }));
    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"direct"');
    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)).toContain(
      '"selectionSource":"direct"',
    );

    checkoutView.unmount();
    renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));
    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"direct"');
    expect(screen.getByTestId('selection')).toHaveTextContent('"selectionMode":"explicit"');
    expect(screen.getByTestId('selection')).toHaveTextContent('cart-old-selection');

    await user.click(screen.getByRole('button', { name: '주문 성공 처리' }));
    await waitFor(() => {
      expect(screen.getByTestId('selection')).toHaveTextContent('"source":"cart"');
      expect(screen.getByTestId('selection')).toHaveTextContent('"checkoutStarted":false');
      expect(screen.getByTestId('selection')).toHaveTextContent('"selectionMode":"explicit"');
      expect(screen.getByTestId('selection')).toHaveTextContent('cart-old-selection');
      expect(screen.getByTestId('selection')).toHaveTextContent('"receipt":"test-order"');
    });
    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)).toContain(
      '"cartItemIds":["cart-old-selection"]',
    );
    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)).toContain(
      '"directLines":[]',
    );

    await user.click(screen.getByRole('button', { name: '장바구니 주문 시작' }));
    await waitFor(() =>
      expect(screen.getByTestId('selection')).toHaveTextContent('cart-product-a'),
    );
    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)).toContain(
      '"selectionSource":"cart"',
    );
  });

  it('keeps a new direct intent if it is created before stored selection restoration finishes', async () => {
    renderCheckout();
    fireEvent.click(screen.getByRole('button', { name: '바로 구매 시작' }));
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));
    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"direct"');
    expect(screen.getByTestId('selection')).toHaveTextContent('size:l');
    expect(screen.getByTestId('selection')).toHaveTextContent('cart-old-selection');
  });

  it('preserves defaultAll cart selection while a direct checkout is active', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(
      CHECKOUT_SELECTION_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        cartItemIds: [],
        directLines: [],
        selectionMode: 'defaultAll',
        selectionSource: 'cart',
        checkoutStarted: false,
      }),
    );
    renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));

    await user.click(screen.getByRole('button', { name: '바로 구매 시작' }));

    expect(screen.getByTestId('selection')).toHaveTextContent('"selectionMode":"defaultAll"');
    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)).toContain(
      '"selectionMode":"defaultAll"',
    );
  });

  it('stores a cart selection as active cart state when changed during direct checkout', async () => {
    const user = userEvent.setup();
    const checkoutView = renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));

    await user.click(screen.getByRole('button', { name: '바로 구매 시작' }));
    await user.click(screen.getByRole('button', { name: '장바구니 선택 변경' }));

    const expectedCartSelection = {
      cartItemIds: ['cart-new-selection'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: false,
    };
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toEqual(expectedCartSelection);
    expect(screen.getByTestId('selection')).toHaveTextContent('"checkoutStarted":false');

    checkoutView.unmount();
    renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));
    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"cart"');
    expect(screen.getByTestId('selection')).toHaveTextContent('"selectionMode":"explicit"');
    expect(screen.getByTestId('selection')).toHaveTextContent('cart-new-selection');
    expect(screen.getByTestId('selection')).toHaveTextContent('"directLines":[]');
  });

  it('rejects new checkout and shipping changes while preserving the active order response', async () => {
    const user = userEvent.setup();
    renderCheckout();
    await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('"ready":true'));

    await user.click(screen.getByRole('button', { name: '바로 구매 시작' }));
    await user.click(screen.getByRole('button', { name: '주문 요청 시점 저장' }));
    await user.click(screen.getByRole('button', { name: '주문 중 새 주문 정보 변경 시도' }));

    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"direct"');
    expect(screen.getByTestId('selection')).toHaveTextContent('"orderPending":true');
    expect(screen.getByTestId('selection')).toHaveTextContent('"shippingAddress":null');
    expect(screen.getByTestId('selection')).toHaveTextContent('"paymentMethod":"creditCard"');
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toMatchObject({
      cartItemIds: ['cart-old-selection'],
      directLines: [
        { productId: 'product-a', optionId: 'size:m', quantity: 2 },
        { productId: 'product-a', optionId: 'size:l', quantity: 1 },
      ],
      selectionSource: 'direct',
      checkoutStarted: true,
    });

    await user.click(screen.getByRole('button', { name: '저장된 주문 성공 처리' }));

    expect(screen.getByTestId('selection')).toHaveTextContent('"source":"cart"');
    expect(screen.getByTestId('selection')).toHaveTextContent('cart-old-selection');
    expect(screen.getByTestId('selection')).toHaveTextContent('"receipt":"test-order"');
    expect(screen.getByTestId('selection')).toHaveTextContent('"orderPending":false');
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toEqual({
      cartItemIds: ['cart-old-selection'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: false,
    });
  });
});
