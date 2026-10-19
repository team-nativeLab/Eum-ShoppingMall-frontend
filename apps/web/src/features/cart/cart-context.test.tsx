import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@eum/api/errors';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Product } from '@eum/api/types';
import { CartLink } from '@/components/cart-link';
import { CheckoutProvider, useCheckout } from '@/features/checkout/checkout-context';
import { CartProvider, useCart } from './cart-context';
import {
  CART_STORAGE_KEY,
  ORDERED_CART_CLEANUP_STORAGE_KEY,
  parseStoredCart,
  serializeCart,
  writePendingOrderedCartCleanup,
} from './cart-storage';

const { getProductById } = vi.hoisted(() => ({ getProductById: vi.fn() }));

vi.mock('@/lib/shop-api', () => ({
  getShopApi: async () => ({ products: { getById: getProductById } }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const visibleProduct: Product = {
  id: 'p-visible',
  name: '표시 상품',
  brand: '브랜드',
  categoryId: 'cat',
  price: 18000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
  modelName: null,
  images: [],
  options: [],
  specifications: [],
  certifications: [],
  shipping: {
    method: '일반 배송',
    estimate: '2~3일',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '',
  },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  isFeatured: false,
};
const optionProduct: Product = {
  ...visibleProduct,
  id: 'p-option',
  name: '옵션 상품',
  price: 20000,
  options: [
    {
      id: 'type',
      label: '형태',
      required: true,
      choices: [
        { id: 'wall', label: '벽걸이형', priceDelta: 0 },
        { id: 'stand', label: '스탠드형(신규)', priceDelta: 3000 },
      ],
    },
  ],
};
const hiddenProduct: Product = {
  ...visibleProduct,
  id: 'p-hidden',
  name: '미표시 상품',
  price: null,
  priceVisible: false,
};

function CartProbe() {
  const {
    cartGroups,
    cartTotals,
    totalQuantity,
    addToCart,
    hasRestored,
    restoreError,
    orderCleanupError,
    hasPendingOrderCleanup,
    isOrderPending,
    retryRestore,
    consumeOrderedCartItems,
  } = useCart();
  const checkout = useCheckout();
  const orderRequestIdRef = useRef<number | null>(null);
  return (
    <div>
      <p data-testid="cart-has-restored">{hasRestored ? '복원 완료' : '복원 중'}</p>
      <p data-testid="cart-restore-error">{restoreError ? '복원 실패' : '복원 정상'}</p>
      <p data-testid="cart-order-cleanup-error">{String(orderCleanupError)}</p>
      <p data-testid="cart-has-pending-cleanup">{String(hasPendingOrderCleanup)}</p>
      <p data-testid="cart-order-pending">{String(isOrderPending)}</p>
      <p data-testid="cart-total-quantity">수량 {totalQuantity}</p>
      <p>합계 {cartTotals.productTotal}</p>
      <p>주문 불가 {cartGroups.unorderableItems.length}</p>
      <output data-testid="order-pending">{String(checkout.isOrderPending)}</output>
      <CartLink />
      <button type="button" onClick={() => addToCart(visibleProduct, 2)}>
        표시 상품 담기
      </button>
      <button type="button" onClick={() => addToCart(hiddenProduct)}>
        미표시 상품 담기
      </button>
      <button type="button" onClick={() => addToCart(visibleProduct, 1, 'blue', '파랑')}>
        파랑 옵션 담기
      </button>
      <button type="button" onClick={() => addToCart(visibleProduct, 1, 'red', '빨강')}>
        빨강 옵션 담기
      </button>
      <button type="button" onClick={() => addToCart(optionProduct, 2, 'wall', '벽걸이형')}>
        옵션 상품 담기
      </button>
      <button
        type="button"
        onClick={() => {
          const requestId = checkout.beginOrderRequest(checkout.checkoutGeneration);
          if (requestId === null) return;
          orderRequestIdRef.current = requestId;
          addToCart(optionProduct, 1, 'wall', '벽걸이형');
        }}
      >
        주문 시작 후 같은 옵션 상품 담기
      </button>
      <button
        type="button"
        onClick={() => {
          if (orderRequestIdRef.current === null) return;
          checkout.finishOrderRequest(orderRequestIdRef.current);
          orderRequestIdRef.current = null;
        }}
      >
        주문 요청 종료
      </button>
      <button type="button" onClick={() => addToCart(optionProduct, 1, 'wall', '벽걸이형')}>
        같은 옵션 상품 1개 담기
      </button>
      <button type="button" onClick={retryRestore}>
        복원 다시 시도
      </button>
      <button
        type="button"
        onClick={() => {
          const requestId = checkout.beginOrderRequest(checkout.checkoutGeneration);
          if (requestId === null) return;
          checkout.finishOrderRequest(requestId);
          consumeOrderedCartItems([{ productId: visibleProduct.id, quantity: 2, optionId: null }]);
        }}
      >
        성공 주문 후 장바구니 정리
      </button>
    </div>
  );
}

function CartRestoreRaceProbe({ tab }: { tab: 'a' | 'b' }) {
  const { totalQuantity, hasRestored, retryRestore, consumeOrderedCartItems } = useCart();
  return (
    <section>
      <output data-testid={`tab-${tab}-quantity`}>{totalQuantity}</output>
      <output data-testid={`tab-${tab}-restored`}>{String(hasRestored)}</output>
      <button
        type="button"
        onClick={() =>
          consumeOrderedCartItems([{ productId: visibleProduct.id, quantity: 2, optionId: null }])
        }
      >
        tab {tab} 주문 수량 차감
      </button>
      <button type="button" onClick={retryRestore}>
        tab {tab} 복원 다시 시도
      </button>
    </section>
  );
}

function StorageRestoreProbe({
  onAddToCartReady,
}: {
  onAddToCartReady: (attemptAdd: () => boolean) => void;
}) {
  const { addToCart, totalQuantity, isOrderPending } = useCart();
  useLayoutEffect(() => {
    onAddToCartReady(() => addToCart(visibleProduct));
  }, [addToCart, onAddToCartReady]);
  return (
    <section>
      <output data-testid="storage-restore-quantity">{totalQuantity}</output>
      <output data-testid="storage-restore-pending">{String(isOrderPending)}</output>
    </section>
  );
}

function CleanupIntentLoadingProbe() {
  const { addToCart, totalQuantity, isOrderPending } = useCart();
  const attemptedRef = useRef(false);
  const [initialPending] = useState(isOrderPending);
  const [addResult, setAddResult] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    setAddResult(addToCart(visibleProduct));
  }, [addToCart]);
  return (
    <section>
      <output data-testid="cleanup-gate-initial-pending">{String(initialPending)}</output>
      <output data-testid="cleanup-gate-add-result">{String(addResult)}</output>
      <output data-testid="cleanup-gate-quantity">{totalQuantity}</output>
      <output data-testid="cleanup-gate-pending">{String(isOrderPending)}</output>
    </section>
  );
}

const renderCart = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutProvider>
        <CartProvider>
          <CartProbe />
        </CartProvider>
      </CheckoutProvider>
    </QueryClientProvider>,
  );
};

function renderIndependentCarts() {
  const createQueryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <div>
      <QueryClientProvider client={createQueryClient()}>
        <CheckoutProvider>
          <CartProvider>
            <CartRestoreRaceProbe tab="a" />
          </CartProvider>
        </CheckoutProvider>
      </QueryClientProvider>
      <QueryClientProvider client={createQueryClient()}>
        <CheckoutProvider>
          <CartProvider>
            <CartRestoreRaceProbe tab="b" />
          </CartProvider>
        </CheckoutProvider>
      </QueryClientProvider>
    </div>,
  );
}

function renderCleanupIntentLoadingCart() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutProvider>
        <CartProvider>
          <CleanupIntentLoadingProbe />
        </CartProvider>
      </CheckoutProvider>
    </QueryClientProvider>,
  );
}

async function waitForRestore() {
  await screen.findByText('복원 완료');
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  getProductById.mockImplementation(async (productId: string) => {
    if (productId === visibleProduct.id) return visibleProduct;
    if (productId === hiddenProduct.id) return hiddenProduct;
    if (productId === optionProduct.id) return optionProduct;
    throw new ApiError('NOT_FOUND', '상품을 찾을 수 없습니다.');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CartProvider', () => {
  it('retries the recorded order cleanup until localStorage accepts it', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
      ]),
    );
    const user = userEvent.setup();
    renderCart();
    await waitForRestore();

    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: '성공 주문 후 장바구니 정리' }));

    await waitFor(() => {
      expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-has-pending-cleanup')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('cart-has-restored')).toHaveTextContent('복원 완료');
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('2');
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
    ]);
    expect(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '복원 다시 시도' }));
    await waitFor(() =>
      expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('true'),
    );
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('2');
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
    ]);

    setItemSpy.mockImplementation(function (this: Storage, key: string, value: string) {
      originalSetItem.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: '복원 다시 시도' }));
    await waitFor(() =>
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('false');
    expect(screen.getByTestId('cart-has-pending-cleanup')).toHaveTextContent('false');
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([]);
    expect(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('0');
  });

  it('keeps successful-order cleanup pending when localStorage cannot be read', async () => {
    const originalCart = serializeCart([
      { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, originalCart);
    const user = userEvent.setup();
    renderCart();
    await waitForRestore();

    const originalGetItem = Storage.prototype.getItem;
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('denied', 'SecurityError');
      }
      return originalGetItem.call(this, key);
    });
    const originalSetItem = Storage.prototype.setItem;
    const cartSetItemSpy = vi.fn(function (this: Storage, key: string, value: string) {
      originalSetItem.call(this, key, value);
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        cartSetItemSpy.call(this, key, value);
        return;
      }
      originalSetItem.call(this, key, value);
    });

    await user.click(screen.getByRole('button', { name: '성공 주문 후 장바구니 정리' }));

    await waitFor(() => {
      expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-has-pending-cleanup')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('true');
    });
    expect(cartSetItemSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('2');
    expect(originalGetItem.call(window.localStorage, CART_STORAGE_KEY)).toBe(originalCart);
    const pendingIntent: unknown = JSON.parse(
      window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY) ?? 'null',
    );
    expect(pendingIntent).toMatchObject({ beforeLines: null, afterLines: null });

    getItemSpy.mockImplementation(originalGetItem);
    await user.click(screen.getByRole('button', { name: '복원 다시 시도' }));
    await waitFor(() =>
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('false'),
    );
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([]);
    expect(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY)).toBeNull();
  });

  it('does not hydrate or persist an empty cart when initial storage access fails', async () => {
    const originalCart = serializeCart([
      { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, originalCart);
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('denied', 'SecurityError');
      }
      return originalGetItem.call(this, key);
    });
    const originalSetItem = Storage.prototype.setItem;
    const cartSetItemSpy = vi.fn();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        cartSetItemSpy();
      }
      originalSetItem.call(this, key, value);
    });

    renderCart();

    await waitFor(() =>
      expect(screen.getByTestId('cart-restore-error')).toHaveTextContent('복원 실패'),
    );
    expect(screen.getByTestId('cart-has-restored')).toHaveTextContent('복원 중');
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('0');
    expect(cartSetItemSpy).not.toHaveBeenCalled();
    expect(originalGetItem.call(window.localStorage, CART_STORAGE_KEY)).toBe(originalCart);
  });

  it('keeps the hydrated cart when storage-event reads and later persistence reads fail', async () => {
    const originalCart = serializeCart([
      { productId: visibleProduct.id, quantity: 1, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, originalCart);
    renderCart();
    await waitForRestore();

    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('denied', 'SecurityError');
      }
      return originalGetItem.call(this, key);
    });
    const originalSetItem = Storage.prototype.setItem;
    const cartSetItemSpy = vi.fn();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        cartSetItemSpy();
      }
      originalSetItem.call(this, key, value);
    });

    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: serializeCart([]) }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('cart-restore-error')).toHaveTextContent('복원 실패'),
    );
    expect(screen.getByTestId('cart-has-restored')).toHaveTextContent('복원 완료');
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('3');
    expect(cartSetItemSpy).not.toHaveBeenCalled();
    expect(originalGetItem.call(window.localStorage, CART_STORAGE_KEY)).toBe(originalCart);
  });

  it('does not accept a pending hydration result after snapshot validation cannot read storage', async () => {
    const originalCart = serializeCart([
      { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, originalCart);
    let resolveProduct: (product: Product) => void = () => undefined;
    getProductById.mockImplementationOnce(
      () =>
        new Promise<Product>((resolve) => {
          resolveProduct = resolve;
        }),
    );
    renderCart();
    await waitFor(() => expect(getProductById).toHaveBeenCalled());

    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('denied', 'SecurityError');
      }
      return originalGetItem.call(this, key);
    });
    const originalSetItem = Storage.prototype.setItem;
    const cartSetItemSpy = vi.fn();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        cartSetItemSpy();
      }
      originalSetItem.call(this, key, value);
    });

    await act(async () => {
      resolveProduct(visibleProduct);
    });

    await waitFor(() =>
      expect(screen.getByTestId('cart-restore-error')).toHaveTextContent('복원 실패'),
    );
    expect(screen.getByTestId('cart-has-restored')).toHaveTextContent('복원 중');
    expect(cartSetItemSpy).not.toHaveBeenCalled();
    expect(originalGetItem.call(window.localStorage, CART_STORAGE_KEY)).toBe(originalCart);
  });

  it('provider remount retries a pending order cleanup from sessionStorage', async () => {
    const orderedLines = [{ productId: visibleProduct.id, quantity: 2, optionId: null }];
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
      ]),
    );
    expect(
      writePendingOrderedCartCleanup(
        orderedLines,
        [{ productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null }],
        [],
      ),
    ).toBe(true);
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });

    const firstProvider = renderCart();
    await waitFor(() =>
      expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('true'),
    );
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toHaveLength(1);
    firstProvider.unmount();

    setItemSpy.mockImplementation(function (this: Storage, key: string, value: string) {
      originalSetItem.call(this, key, value);
    });
    renderCart();
    await waitFor(() =>
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('false'),
    );

    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([]);
    expect(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY)).toBeNull();
  });

  it('recognizes a persisted after snapshot after remount without subtracting twice', async () => {
    const orderedLines = [{ productId: visibleProduct.id, quantity: 2, optionId: null }];
    const beforeLines = [
      { productId: visibleProduct.id, quantity: 5, optionId: null, optionLabel: null },
    ];
    const afterLines = [
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ];
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(beforeLines));
    expect(writePendingOrderedCartCleanup(orderedLines, beforeLines, afterLines, 'applying')).toBe(
      true,
    );
    // Simulate a crash after localStorage succeeds but before session intent cleanup.
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(afterLines));

    renderCart();
    await waitFor(() =>
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('false'),
    );

    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual(afterLines);
    expect(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('3');
  });

  it('keeps an applying cleanup locked when storage returned to its before snapshot', async () => {
    const orderedLines = [{ productId: visibleProduct.id, quantity: 2, optionId: null }];
    const beforeLines = [
      { productId: visibleProduct.id, quantity: 5, optionId: null, optionLabel: null },
    ];
    const afterLines = [
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ];
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(beforeLines));
    expect(writePendingOrderedCartCleanup(orderedLines, beforeLines, afterLines, 'applying')).toBe(
      true,
    );
    const originalSetItem = Storage.prototype.setItem;
    const cartWrites = vi.fn();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) cartWrites();
      originalSetItem.call(this, key, value);
    });

    renderCart();

    await waitFor(() => {
      expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('5');
    });
    expect(cartWrites).not.toHaveBeenCalled();
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual(beforeLines);
    expect(
      JSON.parse(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY) ?? 'null'),
    ).toMatchObject({ phase: 'applying' });
  });

  it('blocks cart actions for every source until the session cleanup intent is loaded', async () => {
    const orderedLines = [{ productId: visibleProduct.id, quantity: 2, optionId: null }];
    const beforeLines = [
      { productId: visibleProduct.id, quantity: 2, optionId: null, optionLabel: null },
    ];
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(beforeLines));
    expect(writePendingOrderedCartCleanup(orderedLines, beforeLines, [])).toBe(true);
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === CART_STORAGE_KEY) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });

    renderCleanupIntentLoadingCart();

    expect(screen.getByTestId('cleanup-gate-add-result')).toHaveTextContent('false');
    expect(screen.getByTestId('cleanup-gate-initial-pending')).toHaveTextContent('true');
    await waitFor(() =>
      expect(screen.getByTestId('cleanup-gate-pending')).toHaveTextContent('true'),
    );
    expect(screen.getByTestId('cleanup-gate-quantity')).toHaveTextContent('2');
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual(beforeLines);
  });

  it('reconciles ordered rows despite unrelated row changes and row reordering', async () => {
    const orderedLines = [{ productId: visibleProduct.id, quantity: 2, optionId: null }];
    const beforeLines = [
      { productId: visibleProduct.id, quantity: 5, optionId: null, optionLabel: null },
      { productId: hiddenProduct.id, quantity: 1, optionId: null, optionLabel: null },
    ];
    const afterLines = [
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
      { productId: hiddenProduct.id, quantity: 1, optionId: null, optionLabel: null },
    ];
    const latestLines = [
      { productId: hiddenProduct.id, quantity: 4, optionId: null, optionLabel: null },
      { productId: visibleProduct.id, quantity: 5, optionId: null, optionLabel: null },
    ];
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(beforeLines));
    expect(writePendingOrderedCartCleanup(orderedLines, beforeLines, afterLines)).toBe(true);
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(latestLines));

    renderCart();

    await waitFor(() =>
      expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('false'),
    );
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: hiddenProduct.id, quantity: 4, optionId: null, optionLabel: null },
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ]);
    expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('7');
    expect(window.sessionStorage.getItem(ORDERED_CART_CLEANUP_STORAGE_KEY)).toBeNull();
  });

  it('keeps cleanup pending without subtracting when storage matches neither saved snapshot', async () => {
    const orderedLines = [{ productId: visibleProduct.id, quantity: 2, optionId: null }];
    const beforeLines = [
      { productId: visibleProduct.id, quantity: 5, optionId: null, optionLabel: null },
    ];
    const afterLines = [
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ];
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(beforeLines));
    expect(writePendingOrderedCartCleanup(orderedLines, beforeLines, afterLines)).toBe(true);
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { productId: visibleProduct.id, quantity: 6, optionId: null, optionLabel: null },
      ]),
    );

    renderCart();

    await waitFor(() => {
      expect(screen.getByTestId('cart-order-cleanup-error')).toHaveTextContent('true');
      expect(screen.getByTestId('cart-has-pending-cleanup')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('cart-order-pending')).toHaveTextContent('true');
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: visibleProduct.id, quantity: 6, optionId: null, optionLabel: null },
    ]);
  });

  it('does not persist a stale restore from another provider after ordered quantity is consumed', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { productId: visibleProduct.id, quantity: 5, optionId: null, optionLabel: null },
      ]),
    );
    let resolveTabBRestore: ((product: Product) => void) | undefined;
    getProductById
      .mockImplementationOnce(async () => visibleProduct)
      .mockImplementationOnce(
        () =>
          new Promise<Product>((resolve) => {
            resolveTabBRestore = resolve;
          }),
      )
      .mockImplementation(async () => visibleProduct);

    const user = userEvent.setup();
    renderIndependentCarts();

    await waitFor(() => expect(screen.getByTestId('tab-a-quantity')).toHaveTextContent('5'));
    await waitFor(() => expect(resolveTabBRestore).toBeDefined());
    await user.click(screen.getByRole('button', { name: 'tab a 주문 수량 차감' }));
    await waitFor(() => expect(screen.getByTestId('tab-a-quantity')).toHaveTextContent('3'));
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ]);

    const finishStaleRestore = resolveTabBRestore;
    if (!finishStaleRestore) throw new Error('Expected tab B restore to remain pending.');
    await act(async () => {
      finishStaleRestore(visibleProduct);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ]);
    expect(screen.getByTestId('tab-b-restored')).toHaveTextContent('false');

    await user.click(screen.getByRole('button', { name: 'tab b 복원 다시 시도' }));
    await waitFor(() => expect(screen.getByTestId('tab-b-quantity')).toHaveTextContent('3'));
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: visibleProduct.id, quantity: 3, optionId: null, optionLabel: null },
    ]);
  });

  it('blocks a same-option add synchronously during checkout and allows it again after settling', async () => {
    renderCart();
    await waitForRestore();

    await userEvent.click(screen.getByRole('button', { name: '옵션 상품 담기' }));
    expect(screen.getByText('수량 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '주문 시작 후 같은 옵션 상품 담기' }));
    expect(screen.getByTestId('order-pending')).toHaveTextContent('true');
    expect(screen.getByText('수량 2')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /장바구니/ })).not.toBeInTheDocument();
    expect(screen.getByText('장바구니').closest('[aria-disabled="true"]')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '주문 요청 종료' }));
    expect(screen.getByTestId('order-pending')).toHaveTextContent('false');
    await userEvent.click(screen.getByRole('button', { name: '같은 옵션 상품 1개 담기' }));
    expect(screen.getByText('수량 3')).toBeInTheDocument();
  });

  it('shows pending additions immediately and then shows the restored merged quantity', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([{ productId: 'p-visible', quantity: 1, optionId: null, optionLabel: null }]),
    );
    let resolveProduct: (product: Product) => void = () => undefined;
    getProductById.mockImplementationOnce(
      () =>
        new Promise<Product>((resolve) => {
          resolveProduct = resolve;
        }),
    );

    renderCart();
    expect(screen.getByText('복원 중')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '장바구니' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /장바구니 상품 \d+개/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    expect(screen.getByRole('link', { name: /장바구니.*상품 2개/ })).toBeInTheDocument();

    await act(async () => {
      resolveProduct(visibleProduct);
    });
    await waitForRestore();
    expect(screen.getByRole('link', { name: /장바구니.*상품 3개/ })).toBeInTheDocument();
  });

  it('localStorage 쓰기가 실패해도 메모리 상태로 계속 동작합니다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    renderCart();
    await waitForRestore();
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    expect(screen.getByText('수량 2')).toBeInTheDocument();
  });

  it('다른 탭에서 저장소를 비우면(key=null) 장바구니도 비웁니다', async () => {
    renderCart();
    await waitForRestore();
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    window.localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
    });
    expect(await screen.findByText('수량 0')).toBeInTheDocument();
  });

  it('담은 상품을 그룹으로 나누고 주문 가능 항목만 합산합니다', async () => {
    renderCart();
    await waitForRestore();
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    await userEvent.click(screen.getByRole('button', { name: '미표시 상품 담기' }));
    expect(screen.getByText('수량 3')).toBeInTheDocument();
    expect(screen.getByText('합계 36000')).toBeInTheDocument();
    expect(screen.getByText('주문 불가 1')).toBeInTheDocument();
  });

  it('동일 상품의 다른 옵션은 별도 장바구니 줄로 저장합니다', async () => {
    renderCart();
    await waitForRestore();
    await userEvent.click(screen.getByRole('button', { name: '파랑 옵션 담기' }));
    await userEvent.click(screen.getByRole('button', { name: '빨강 옵션 담기' }));
    const savedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}');
    expect(savedCart.cartItems).toEqual([
      { productId: 'p-visible', quantity: 1, optionId: 'blue', optionLabel: '파랑' },
      { productId: 'p-visible', quantity: 1, optionId: 'red', optionLabel: '빨강' },
    ]);
  });

  it('상품 ID에서 최신 상품 데이터를 다시 조회해 복원하고 상품 스냅샷 없이 저장합니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([{ productId: 'p-visible', quantity: 1, optionId: null, optionLabel: null }]),
    );
    renderCart();
    await waitFor(() => expect(screen.getByText('수량 1')).toBeInTheDocument());
    expect(getProductById).toHaveBeenCalledWith('p-visible', expect.anything());
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    const storedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}');
    expect(storedCart.cartItems[0].quantity).toBe(3);
    expect(storedCart.cartItems[0]).not.toHaveProperty('product');
    expect(storedCart.cartItems[0]).not.toHaveProperty('name');
  });

  it('없는 상품 줄만 복원에서 제외합니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { productId: 'p-visible', quantity: 1, optionId: null, optionLabel: null },
        { productId: 'p-gone', quantity: 3, optionId: null, optionLabel: null },
      ]),
    );
    renderCart();
    await waitFor(() => expect(screen.getByText('수량 1')).toBeInTheDocument());
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}').cartItems).toEqual([
        { productId: 'p-visible', quantity: 1, optionId: null, optionLabel: null },
      ]),
    );
  });

  it('일시 API 오류면 저장 항목을 유지하고 복원 실패를 표시합니다', async () => {
    const rawStoredCart = serializeCart([
      { productId: 'p-fails', quantity: 2, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, rawStoredCart);
    getProductById.mockRejectedValueOnce(new ApiError('NETWORK', '잠시 후 다시 시도해 주세요.'));
    renderCart();
    expect(await screen.findByText('복원 실패')).toBeInTheDocument();
    expect(screen.getByText('복원 중')).toBeInTheDocument();
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe(rawStoredCart);
  });

  it('복원 오류 후 재시도하면 보존한 저장 항목을 최신 상품으로 복원합니다', async () => {
    const rawStoredCart = serializeCart([
      { productId: 'p-visible', quantity: 2, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, rawStoredCart);
    getProductById.mockRejectedValueOnce(new ApiError('NETWORK', '잠시 후 다시 시도해 주세요.'));
    renderCart();

    expect(await screen.findByText('복원 실패')).toBeInTheDocument();
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe(rawStoredCart);

    await userEvent.click(screen.getByRole('button', { name: '복원 다시 시도' }));
    await waitFor(() => expect(screen.getByText('복원 완료')).toBeInTheDocument());
    expect(screen.getByText('수량 2')).toBeInTheDocument();
    expect(screen.getByText('복원 정상')).toBeInTheDocument();
    expect(getProductById).toHaveBeenCalledTimes(2);
  });

  it('다른 탭의 storage 이벤트로 장바구니를 다시 조회해 맞춥니다', async () => {
    renderCart();
    await waitForRestore();
    const otherTabValue = serializeCart([
      { productId: 'p-hidden', quantity: 4, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, otherTabValue);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: otherTabValue }),
      );
    });
    expect(await screen.findByText('수량 4')).toBeInTheDocument();
    expect(screen.getByText('주문 불가 1')).toBeInTheDocument();
  });

  it('keeps the current cart visible and blocks mutations while a storage restore is pending', async () => {
    const currentLines = [
      { productId: visibleProduct.id, quantity: 1, optionId: null, optionLabel: null },
    ];
    const externalLines = [
      { productId: hiddenProduct.id, quantity: 4, optionId: null, optionLabel: null },
    ];
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(currentLines));
    let resolveExternalProduct: ((product: Product) => void) | undefined;
    getProductById
      .mockImplementationOnce(async () => visibleProduct)
      .mockImplementationOnce(
        () =>
          new Promise<Product>((resolve) => {
            resolveExternalProduct = resolve;
          }),
      );
    let attemptAddToCart: (() => boolean) | undefined;
    const handleAddToCartReady = (attempt: () => boolean) => {
      attemptAddToCart = attempt;
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutProvider>
          <CartProvider>
            <StorageRestoreProbe onAddToCartReady={handleAddToCartReady} />
          </CartProvider>
        </CheckoutProvider>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('storage-restore-quantity')).toHaveTextContent('1'),
    );
    const addUsingPreviousContext = attemptAddToCart;

    const externalStorageValue = serializeCart(externalLines);
    window.localStorage.setItem(CART_STORAGE_KEY, externalStorageValue);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: externalStorageValue }),
      );
    });

    expect(screen.getByTestId('storage-restore-quantity')).toHaveTextContent('1');
    expect(screen.getByTestId('storage-restore-pending')).toHaveTextContent('true');
    expect(addUsingPreviousContext?.()).toBe(false);
    expect(screen.getByTestId('storage-restore-quantity')).toHaveTextContent('1');

    await waitFor(() => expect(resolveExternalProduct).toBeDefined());
    const finishExternalRestore = resolveExternalProduct;
    if (!finishExternalRestore) throw new Error('Expected the external product lookup to wait.');
    await act(async () => {
      finishExternalRestore(hiddenProduct);
    });

    await waitFor(() => {
      expect(screen.getByTestId('storage-restore-quantity')).toHaveTextContent('4');
      expect(screen.getByTestId('storage-restore-pending')).toHaveTextContent('false');
    });
  });

  it('복원이 끝나기 전에 담은 상품은 복원 결과에 합쳐 보존합니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([{ productId: 'p-visible', quantity: 1, optionId: null, optionLabel: null }]),
    );
    let resolveProduct: (product: Product) => void = () => undefined;
    getProductById.mockImplementationOnce(
      () =>
        new Promise<Product>((resolve) => {
          resolveProduct = resolve;
        }),
    );
    renderCart();
    expect(screen.getByText('복원 중')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    await userEvent.click(screen.getByRole('button', { name: '미표시 상품 담기' }));
    await act(async () => {
      resolveProduct(visibleProduct);
    });
    await waitForRestore();
    expect(screen.getByText('수량 4')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}').cartItems).toEqual([
      { productId: 'p-visible', quantity: 3, optionId: null, optionLabel: null },
      { productId: 'p-hidden', quantity: 1, optionId: null, optionLabel: null },
    ]);
  });

  it('복원 실패 상태에서 담은 상품도 재시도 후 저장 항목과 합칩니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([{ productId: 'p-visible', quantity: 2, optionId: null, optionLabel: null }]),
    );
    getProductById.mockRejectedValueOnce(new ApiError('NETWORK', '잠시 후 다시 시도해 주세요.'));
    renderCart();
    expect(await screen.findByText('복원 실패')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '미표시 상품 담기' }));

    await userEvent.click(screen.getByRole('button', { name: '복원 다시 시도' }));
    await waitForRestore();
    expect(screen.getByText('수량 3')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}').cartItems).toEqual([
      { productId: 'p-visible', quantity: 2, optionId: null, optionLabel: null },
      { productId: 'p-hidden', quantity: 1, optionId: null, optionLabel: null },
    ]);
  });

  it('복원 시 옵션 문구를 최신 상품 기준으로 갱신하고 추가금을 합계에 반영합니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        {
          productId: 'p-option',
          quantity: 2,
          optionId: 'type:stand',
          optionLabel: '형태: 옛 문구',
        },
      ]),
    );
    renderCart();
    expect(await screen.findByText('합계 46000')).toBeInTheDocument();
    expect(screen.getByText('주문 불가 0')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}').cartItems).toEqual([
      {
        productId: 'p-option',
        quantity: 2,
        optionId: 'type:stand',
        optionLabel: '형태: 스탠드형(신규)',
      },
    ]);
  });

  it('상품에서 사라진 옵션으로 담긴 줄은 주문할 수 없는 상품으로 분리합니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { productId: 'p-option', quantity: 1, optionId: 'type:floor', optionLabel: '형태: 바닥형' },
      ]),
    );
    renderCart();
    await waitForRestore();
    expect(screen.getByText('주문 불가 1')).toBeInTheDocument();
    expect(screen.getByText('합계 0')).toBeInTheDocument();
  });

  it('깨진 저장 값은 빈 장바구니로 시작합니다', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{oops');
    renderCart();
    await waitFor(() => expect(screen.getByText('수량 0')).toBeInTheDocument());
  });
});
