import type {
  Address,
  CheckoutOptions,
  Coupon,
  CreateOrderInput,
  Member,
  OrderReceipt,
  Product,
} from '@eum/api/types';
import type { ShopApi } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberSessionProvider } from '@/features/auth/member-session';
import { CartProvider, useCart } from '@/features/cart/cart-context';
import {
  CART_STORAGE_KEY,
  parseStoredCart,
  serializeCart,
  writePendingOrderedCartCleanup,
} from '@/features/cart/cart-storage';
import { getShopApi } from '@/lib/shop-api';
import { CheckoutProvider, useCheckout } from './checkout-context';
import {
  CHECKOUT_SELECTION_STORAGE_KEY,
  parseCheckoutSelection,
} from './checkout-selection-storage';
import { PaymentPageView } from './payment-page';
import { ShippingPageView } from './shipping-page';

const apiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getShopApi: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
vi.mock('@/lib/member-auth', () => ({
  getMemberAuth: async () => ({ getCurrentUser: apiMocks.getCurrentUser }),
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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: apiMocks.routerPush }) }));

const product: Product = {
  id: 'payment-test-product',
  name: '테스트 상품',
  brand: '테스트 브랜드',
  categoryId: 'test-category',
  price: 18_000,
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
    estimate: '2~3일 이내 출고',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '',
  },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-10-16T00:00:00.000Z',
  isFeatured: false,
};

const productWithOption: Product = {
  ...product,
  options: [
    {
      id: 'size',
      label: '사이즈',
      required: true,
      choices: [{ id: 'm', label: 'M', priceDelta: 0 }],
    },
  ],
};

const member: Member = {
  id: 'payment-test-member',
  email: 'member@example.test',
  name: '테스트 회원',
  phone: '01012345678',
  joinedAt: '2026-10-16T00:00:00.000Z',
  pointBalance: 0,
};

const activeCoupon: Coupon = {
  id: 'payment-test-coupon',
  name: '테스트 쿠폰',
  discountType: 'amount',
  discountValue: 1000,
  minOrderAmount: 0,
  expiresAt: '2026-12-31T23:59:59+09:00',
  isUsed: false,
};

const shippingAddress: Address = {
  id: 'payment-test-address',
  label: '집',
  recipientName: member.name,
  phone: member.phone,
  postalCode: '12345',
  address1: '테스트 주소',
  address2: '',
  isDefault: true,
};

const checkoutOptions: CheckoutOptions = {
  freeShippingThreshold: 50_000,
  shippingFee: 3000,
  deliveryRequests: [],
  shippingMethods: [{ id: 'standard', label: '일반 배송', description: '2~3일' }],
  paymentMethods: [{ id: 'bankTransfer', label: '계좌 이체' }],
};

const receipt: OrderReceipt = {
  orderNumber: 'ORDER-PAYMENT-TEST',
  productTotal: 18_000,
  discountTotal: 0,
  shippingFee: 3000,
  pointsUsed: 0,
  paymentTotal: 21_000,
};

const productById = new Map([[product.id, product]]);

function configureApi({
  getOptions = async () => checkoutOptions,
  listCoupons = async () => [],
  createOrder = vi.fn(async (_input: CreateOrderInput) => receipt),
  productResponses = productById,
}: {
  getOptions?: () => Promise<CheckoutOptions>;
  listCoupons?: () => Promise<Coupon[]>;
  createOrder?: (input: CreateOrderInput) => Promise<OrderReceipt>;
  productResponses?: ReadonlyMap<string, Product>;
} = {}) {
  const shopApi = {
    checkout: { getOptions },
    coupons: { list: listCoupons },
    orders: { create: createOrder },
    addresses: { list: async () => [shippingAddress] },
    products: {
      getById: async (productId: string) => {
        const foundProduct = productResponses.get(productId);
        if (!foundProduct) throw new Error(`Unknown product: ${productId}`);
        return foundProduct;
      },
    },
  } as unknown as ShopApi;
  vi.mocked(getShopApi).mockResolvedValue(shopApi);
  return createOrder;
}

function CheckoutTestHarness({ includeShippingPage = false }: { includeShippingPage?: boolean }) {
  const checkout = useCheckout();
  const { totalQuantity } = useCart();
  const didSetShippingAddress = useRef(false);

  useEffect(() => {
    if (!checkout.isSelectionReady || didSetShippingAddress.current) return;
    didSetShippingAddress.current = true;
    checkout.setShipping(shippingAddress, 'none');
  }, [checkout]);

  return (
    <>
      <PaymentPageView />
      {includeShippingPage ? <ShippingPageView /> : null}
      <CheckoutStateObserver />
      <output data-testid="cart-total-quantity">{totalQuantity}</output>
      <button type="button" onClick={() => checkout.setCartSelection(['cart-new-selection'])}>
        테스트용 주문 선택 변경
      </button>
      <button
        type="button"
        onClick={() =>
          checkout.setShipping({ ...shippingAddress, address1: '변경된 테스트 주소' }, 'door')
        }
      >
        테스트용 배송지 변경
      </button>
    </>
  );
}

function CheckoutStateObserver() {
  const checkout = useCheckout();
  return (
    <>
      <output data-testid="saved-payment-method">{checkout.paymentMethod}</output>
      <output data-testid="completed-payment-method">
        {checkout.receipt?.paymentMethod ?? ''}
      </output>
      <output data-testid="completed-shipping-address">
        {checkout.receipt?.shippingAddress.address1 ?? ''}
      </output>
      <output data-testid="order-pending">{String(checkout.isOrderPending)}</output>
    </>
  );
}

function renderPaymentPage(includeShippingPage = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>
        <CheckoutProvider>
          <CartProvider>
            <CheckoutTestHarness includeShippingPage={includeShippingPage} />
          </CartProvider>
        </CheckoutProvider>
      </MemberSessionProvider>
    </QueryClientProvider>,
  );
}

function savePaymentCart(quantity = 1) {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    serializeCart([{ productId: product.id, quantity, optionId: null, optionLabel: null }]),
  );
  window.sessionStorage.setItem(
    CHECKOUT_SELECTION_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      cartItemIds: [`cart-${product.id}-default`],
      selectionMode: 'explicit',
      checkoutStarted: true,
    }),
  );
}

function saveDirectPaymentIntent() {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    serializeCart([
      {
        productId: productWithOption.id,
        quantity: 3,
        optionId: 'size:m',
        optionLabel: '사이즈: M',
      },
    ]),
  );
  window.sessionStorage.setItem(
    CHECKOUT_SELECTION_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      cartItemIds: [`cart-${productWithOption.id}-size:m`],
      directLines: [{ productId: productWithOption.id, optionId: 'size:m', quantity: 2 }],
      selectionMode: 'explicit',
      selectionSource: 'direct',
      checkoutStarted: true,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  apiMocks.getCurrentUser.mockResolvedValue(member);
  configureApi();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('PaymentPageView', () => {
  it('shows the order-cleanup failure and blocks another payment until cleanup succeeds', async () => {
    const createOrder = configureApi();
    savePaymentCart();
    expect(
      writePendingOrderedCartCleanup([{ productId: product.id, optionId: null, quantity: 1 }]),
    ).toBe(true);
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
    renderPaymentPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /주문은 완료됐지만 주문한 수량을 장바구니에서 정리하지 못했습니다/,
    );
    const paymentButton = await screen.findByRole('button', { name: '결제하기 (1)' });
    expect(paymentButton).toBeDisabled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: product.id, quantity: 1, optionId: null, optionLabel: null },
    ]);
  });

  it('shows checkout option failure while the coupon request is still pending', async () => {
    configureApi({
      getOptions: async () => {
        throw new Error('Checkout options unavailable');
      },
      listCoupons: () => new Promise<Coupon[]>(() => undefined),
    });
    renderPaymentPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '주문서 선택지를 확인할 수 없습니다. 다시 시도해 주세요.',
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  });

  it('retries checkout options while coupons are pending and renders after coupons resolve', async () => {
    const user = userEvent.setup();
    let resolveCoupons: ((coupons: Coupon[]) => void) | undefined;
    const couponsPending = new Promise<Coupon[]>((resolve) => {
      resolveCoupons = resolve;
    });
    let optionsRequestCount = 0;
    configureApi({
      getOptions: async () => {
        optionsRequestCount += 1;
        if (optionsRequestCount === 1) throw new Error('Checkout options unavailable');
        return checkoutOptions;
      },
      listCoupons: () => couponsPending,
    });
    savePaymentCart();
    renderPaymentPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '주문서 선택지를 확인할 수 없습니다. 다시 시도해 주세요.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(optionsRequestCount).toBe(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
    if (!resolveCoupons) throw new Error('Expected the pending coupon request to be captured.');
    resolveCoupons([]);

    expect(await screen.findByRole('radio', { name: '계좌 이체' })).toBeChecked();
  });

  it('uses an available payment method when the saved method is no longer offered', async () => {
    const user = userEvent.setup();
    const createOrder = configureApi();
    savePaymentCart();
    renderPaymentPage();

    const bankTransferRadio = await screen.findByRole('radio', { name: '계좌 이체' });
    expect(bankTransferRadio).toBeChecked();
    expect(screen.queryByRole('radio', { name: '신용카드' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [{ productId: product.id, quantity: 1, optionId: null }],
          paymentMethod: 'bankTransfer',
        }),
      );
      expect(screen.getByTestId('saved-payment-method')).toHaveTextContent('bankTransfer');
      expect(screen.getByTestId('completed-payment-method')).toHaveTextContent('bankTransfer');
      expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([]);
    });
  });

  it('subtracts only the submitted cart quantity after a cross-tab add and ignores stale restore events', async () => {
    const user = userEvent.setup();
    let resolveOrder: ((orderReceipt: OrderReceipt) => void) | undefined;
    let resolveStaleProduct: ((restoredProduct: Product) => void) | undefined;
    const createOrder = vi.fn(
      () =>
        new Promise<OrderReceipt>((resolve) => {
          resolveOrder = resolve;
        }),
    );
    configureApi({ createOrder });
    savePaymentCart(2);
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));

    const currentShopApi = await getShopApi();
    const pendingGetById = vi.fn(
      () =>
        new Promise<Product>((resolve) => {
          resolveStaleProduct = resolve;
        }),
    );
    pendingGetById.mockResolvedValue(product);
    pendingGetById.mockImplementationOnce(
      () =>
        new Promise<Product>((resolve) => {
          resolveStaleProduct = resolve;
        }),
    );
    const pendingProductApi = {
      ...currentShopApi,
      products: {
        ...currentShopApi.products,
        getById: pendingGetById,
      },
    };
    vi.mocked(getShopApi).mockResolvedValue(pendingProductApi);

    const crossTabCartValue = serializeCart([
      { productId: product.id, quantity: 5, optionId: null, optionLabel: null },
    ]);
    window.localStorage.setItem(CART_STORAGE_KEY, crossTabCartValue);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: crossTabCartValue }),
      );
    });
    await waitFor(() => expect(resolveStaleProduct).toBeDefined());

    const resolvePendingOrder = resolveOrder;
    if (!resolvePendingOrder) throw new Error('Expected the pending order request to be captured.');
    await act(async () => {
      resolvePendingOrder(receipt);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: product.id, quantity: 3, optionId: null, optionLabel: null },
    ]);

    const resolvePendingProduct = resolveStaleProduct;
    if (!resolvePendingProduct) throw new Error('Expected the stale cart restore to be pending.');
    await act(async () => {
      resolvePendingProduct(product);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('3'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: crossTabCartValue }),
      );
    });
    await waitFor(() => expect(pendingGetById).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('cart-total-quantity')).toHaveTextContent('3'));
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      { productId: product.id, quantity: 3, optionId: null, optionLabel: null },
    ]);
  });

  it('preserves the same product and option cart line after direct order success', async () => {
    const user = userEvent.setup();
    const createOrder = configureApi({
      productResponses: new Map([[productWithOption.id, productWithOption]]),
    });
    saveDirectPaymentIntent();
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [{ productId: productWithOption.id, quantity: 2, optionId: 'size:m' }],
        }),
      );
      expect(apiMocks.routerPush).toHaveBeenCalledWith('/checkout/complete');
      expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
        {
          productId: productWithOption.id,
          quantity: 3,
          optionId: 'size:m',
          optionLabel: '사이즈: M',
        },
      ]);
      expect(
        parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
      ).toEqual({
        cartItemIds: [`cart-${productWithOption.id}-size:m`],
        directLines: [],
        selectionMode: 'explicit',
        selectionSource: 'cart',
        checkoutStarted: false,
      });
    });
  });

  it('keeps the direct intent and cart line when order creation rejects', async () => {
    const user = userEvent.setup();
    configureApi({
      productResponses: new Map([[productWithOption.id, productWithOption]]),
      createOrder: vi.fn(async () => {
        throw new Error('Order creation failed');
      }),
    });
    saveDirectPaymentIntent();
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '주문을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
    );
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toEqual({
      cartItemIds: [`cart-${productWithOption.id}-size:m`],
      directLines: [{ productId: productWithOption.id, optionId: 'size:m', quantity: 2 }],
      selectionMode: 'explicit',
      selectionSource: 'direct',
      checkoutStarted: true,
    });
    expect(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))).toEqual([
      {
        productId: productWithOption.id,
        quantity: 3,
        optionId: 'size:m',
        optionLabel: '사이즈: M',
      },
    ]);
    expect(apiMocks.routerPush).not.toHaveBeenCalled();
  });

  it('preserves and completes the active order when a new cart selection is attempted', async () => {
    const user = userEvent.setup();
    let resolveOrder: ((orderReceipt: OrderReceipt) => void) | undefined;
    const createOrder = vi.fn(
      () =>
        new Promise<OrderReceipt>((resolve) => {
          resolveOrder = resolve;
        }),
    );
    configureApi({
      productResponses: new Map([[productWithOption.id, productWithOption]]),
      createOrder,
    });
    saveDirectPaymentIntent();
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: '테스트용 주문 선택 변경' }));
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toMatchObject({
      cartItemIds: [`cart-${productWithOption.id}-size:m`],
      directLines: [{ productId: productWithOption.id, optionId: 'size:m', quantity: 2 }],
      selectionSource: 'direct',
      checkoutStarted: true,
    });

    const resolvePendingOrder = resolveOrder;
    if (!resolvePendingOrder) throw new Error('Expected the pending order request to be captured.');
    await act(async () => {
      resolvePendingOrder(receipt);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.routerPush).toHaveBeenCalledWith('/checkout/complete');
    expect(screen.getByTestId('completed-payment-method')).toHaveTextContent('bankTransfer');
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toMatchObject({
      cartItemIds: [`cart-${productWithOption.id}-size:m`],
      directLines: [],
      selectionSource: 'cart',
      checkoutStarted: false,
    });
  });

  it('keeps the active direct intent when a new cart selection is attempted before failure', async () => {
    const user = userEvent.setup();
    let rejectOrder: ((reason?: unknown) => void) | undefined;
    const createOrder = vi.fn(
      () =>
        new Promise<OrderReceipt>((_resolve, reject) => {
          rejectOrder = reject;
        }),
    );
    configureApi({
      productResponses: new Map([[productWithOption.id, productWithOption]]),
      createOrder,
    });
    saveDirectPaymentIntent();
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: '테스트용 주문 선택 변경' }));
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toMatchObject({
      cartItemIds: [`cart-${productWithOption.id}-size:m`],
      directLines: [{ productId: productWithOption.id, optionId: 'size:m', quantity: 2 }],
      selectionSource: 'direct',
      checkoutStarted: true,
    });

    const rejectPendingOrder = rejectOrder;
    if (!rejectPendingOrder) throw new Error('Expected the pending order request to be captured.');
    await act(async () => {
      rejectPendingOrder(new Error('Order failed'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('order-pending')).toHaveTextContent('false'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '주문을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
    );
    expect(screen.getByTestId('completed-payment-method')).toBeEmptyDOMElement();
    expect(apiMocks.routerPush).not.toHaveBeenCalled();
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toMatchObject({
      cartItemIds: [`cart-${productWithOption.id}-size:m`],
      directLines: [{ productId: productWithOption.id, optionId: 'size:m', quantity: 2 }],
      selectionSource: 'direct',
      checkoutStarted: true,
    });
  });

  it('submits only once when the payment button is clicked twice before React rerenders', async () => {
    const user = userEvent.setup();
    let resolveOrder: ((orderReceipt: OrderReceipt) => void) | undefined;
    const createOrder = vi.fn(
      () =>
        new Promise<OrderReceipt>((resolve) => {
          resolveOrder = resolve;
        }),
    );
    configureApi({
      productResponses: new Map([[productWithOption.id, productWithOption]]),
      createOrder,
    });
    saveDirectPaymentIntent();
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    const submitButton = screen.getByRole('button', { name: '결제하기 (1)' });
    act(() => {
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
    });

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    const resolvePendingOrder = resolveOrder;
    if (!resolvePendingOrder) throw new Error('Expected the pending order request to be captured.');
    await act(async () => {
      resolvePendingOrder(receipt);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.routerPush).toHaveBeenCalledTimes(1);
  });

  it('keeps the submitted shipping address and completes when a pending edit is attempted', async () => {
    const user = userEvent.setup();
    let resolveOrder: ((orderReceipt: OrderReceipt) => void) | undefined;
    const createOrder = vi.fn(
      () =>
        new Promise<OrderReceipt>((resolve) => {
          resolveOrder = resolve;
        }),
    );
    configureApi({
      listCoupons: async () => [activeCoupon],
      productResponses: new Map([[productWithOption.id, productWithOption]]),
      createOrder,
    });
    saveDirectPaymentIntent();
    renderPaymentPage();

    await screen.findByRole('radio', { name: '계좌 이체' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link', { name: '변경' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '계좌 이체' })).toBeDisabled();
    const couponSelect = screen.getByLabelText('쿠폰');
    expect(couponSelect).toBeDisabled();
    expect(screen.getByRole('option', { name: /테스트 쿠폰/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '테스트용 배송지 변경' }));

    const resolvePendingOrder = resolveOrder;
    if (!resolvePendingOrder) throw new Error('Expected the pending order request to be captured.');
    await act(async () => {
      resolvePendingOrder(receipt);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.routerPush).toHaveBeenCalledWith('/checkout/complete');
    await waitFor(() => expect(screen.getByTestId('order-pending')).toHaveTextContent('false'));
    expect(screen.getByTestId('completed-payment-method')).toHaveTextContent('bankTransfer');
    expect(screen.getByTestId('completed-shipping-address')).toHaveTextContent('테스트 주소');
    expect(
      parseCheckoutSelection(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY)),
    ).toMatchObject({
      selectionSource: 'cart',
      checkoutStarted: false,
      directLines: [],
    });
  });

  it('disables shipping edits and continue while an order request is pending, then restores them', async () => {
    const user = userEvent.setup();
    let rejectOrder: ((reason?: unknown) => void) | undefined;
    const createOrder = vi.fn(
      () =>
        new Promise<OrderReceipt>((_resolve, reject) => {
          rejectOrder = reject;
        }),
    );
    configureApi({
      listCoupons: async () => [activeCoupon],
      productResponses: new Map([[productWithOption.id, productWithOption]]),
      createOrder,
    });
    saveDirectPaymentIntent();
    renderPaymentPage(true);

    await screen.findByRole('radio', { name: '계좌 이체' });
    const shippingContinueButton = await screen.findByRole('button', {
      name: '결제 단계로 (1)',
    });
    const couponSelect = screen.getByLabelText('쿠폰');
    const deliveryRequestSelect = screen.getByRole('combobox', { name: '배송 요청사항' });
    expect(couponSelect.parentElement).toHaveClass('relative');
    expect(couponSelect).toHaveClass('appearance-none');
    expect(couponSelect.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(couponSelect.parentElement?.querySelector('svg')).toHaveClass('pointer-events-none');
    expect(deliveryRequestSelect.parentElement).toHaveClass('relative');
    expect(deliveryRequestSelect).toHaveClass('appearance-none');
    expect(deliveryRequestSelect.parentElement?.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(deliveryRequestSelect.parentElement?.querySelector('svg')).toHaveClass(
      'pointer-events-none',
    );
    await user.click(screen.getByRole('button', { name: '변경' }));
    await user.click(await screen.findByRole('button', { name: '새 배송지 직접 입력' }));
    const recipientField = screen.getByRole('textbox', { name: '받는 분' });
    await user.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.click(screen.getByRole('button', { name: '결제하기 (1)' }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link', { name: '장바구니로 돌아가기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    expect(shippingContinueButton).toBeDisabled();
    expect(couponSelect).toBeDisabled();
    expect(deliveryRequestSelect).toBeDisabled();
    expect(recipientField).toBeDisabled();

    const rejectPendingOrder = rejectOrder;
    if (!rejectPendingOrder) throw new Error('Expected the pending order request to be captured.');
    await act(async () => {
      rejectPendingOrder(new Error('Order failed'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('order-pending')).toHaveTextContent('false'));
    expect(screen.getByRole('button', { name: '닫기' })).toBeEnabled();
    expect(shippingContinueButton).toBeEnabled();
    expect(couponSelect).toBeEnabled();
    expect(deliveryRequestSelect).toBeEnabled();
    expect(recipientField).toBeEnabled();
  });
});
