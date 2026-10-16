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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberSessionProvider } from '@/features/auth/member-session';
import { CartProvider } from '@/features/cart/cart-context';
import { CART_STORAGE_KEY, serializeCart } from '@/features/cart/cart-storage';
import { getShopApi } from '@/lib/shop-api';
import { CheckoutProvider, useCheckout } from './checkout-context';
import { CHECKOUT_SELECTION_STORAGE_KEY } from './checkout-selection-storage';
import { PaymentPageView } from './payment-page';

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

const member: Member = {
  id: 'payment-test-member',
  email: 'member@example.test',
  name: '테스트 회원',
  phone: '01012345678',
  joinedAt: '2026-10-16T00:00:00.000Z',
  pointBalance: 0,
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
}: {
  getOptions?: () => Promise<CheckoutOptions>;
  listCoupons?: () => Promise<Coupon[]>;
  createOrder?: (input: CreateOrderInput) => Promise<OrderReceipt>;
} = {}) {
  const shopApi = {
    checkout: { getOptions },
    coupons: { list: listCoupons },
    orders: { create: createOrder },
    products: {
      getById: async (productId: string) => {
        const foundProduct = productById.get(productId);
        if (!foundProduct) throw new Error(`Unknown product: ${productId}`);
        return foundProduct;
      },
    },
  } as unknown as ShopApi;
  vi.mocked(getShopApi).mockResolvedValue(shopApi);
  return createOrder;
}

function CheckoutTestHarness() {
  const checkout = useCheckout();
  const didSetShippingAddress = useRef(false);

  useEffect(() => {
    if (!checkout.isSelectionReady || didSetShippingAddress.current) return;
    didSetShippingAddress.current = true;
    checkout.setShipping(shippingAddress, 'none');
  }, [checkout]);

  return (
    <>
      <PaymentPageView />
      <CheckoutStateObserver />
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
    </>
  );
}

function renderPaymentPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>
        <CheckoutProvider>
          <CartProvider>
            <CheckoutTestHarness />
          </CartProvider>
        </CheckoutProvider>
      </MemberSessionProvider>
    </QueryClientProvider>,
  );
}

function savePaymentCart() {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    serializeCart([{ productId: product.id, quantity: 1, optionId: null, optionLabel: null }]),
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

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  apiMocks.getCurrentUser.mockResolvedValue(member);
  configureApi();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PaymentPageView', () => {
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
        expect.objectContaining({ paymentMethod: 'bankTransfer' }),
      );
      expect(screen.getByTestId('saved-payment-method')).toHaveTextContent('bankTransfer');
      expect(screen.getByTestId('completed-payment-method')).toHaveTextContent('bankTransfer');
    });
  });
});
