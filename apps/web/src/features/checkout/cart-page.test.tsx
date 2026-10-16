import type { CheckoutOptions, Product } from '@eum/api/types';
import type { ShopApi } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberSessionProvider } from '@/features/auth/member-session';
import { CartProvider } from '@/features/cart/cart-context';
import { CART_STORAGE_KEY, serializeCart } from '@/features/cart/cart-storage';
import { getShopApi } from '@/lib/shop-api';
import { CheckoutProvider } from './checkout-context';
import { CartPageView } from './cart-page';

const apiMocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));

vi.mock('@/lib/shop-api', () => ({ getShopApi: apiMocks.getShopApi }));
vi.mock('@/lib/member-auth', () => ({
  getMemberAuth: async () => ({ getCurrentUser: async () => null }),
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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const FREE_SHIPPING_THRESHOLD = 50_000;

function buildProduct(id: string, price: number): Product {
  return {
    id,
    name: `상품 ${id}`,
    brand: '테스트 브랜드',
    categoryId: 'category-test',
    price,
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
}

function buildOptions(freeShippingThreshold = FREE_SHIPPING_THRESHOLD): CheckoutOptions {
  return {
    freeShippingThreshold,
    shippingFee: 3000,
    deliveryRequests: [],
    shippingMethods: [{ id: 'standard', label: '일반 배송', description: '2~3일' }],
    paymentMethods: [{ id: 'creditCard', label: '신용카드' }],
  };
}

type CheckoutOptionsResponse = CheckoutOptions | Record<string, unknown> | null;

function configureApi(
  options: CheckoutOptionsResponse | (() => Promise<CheckoutOptionsResponse>) = buildOptions(),
  getProduct: (productId: string) => Promise<Product> = async (productId) => {
    const product = productCatalog.get(productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);
    return product;
  },
) {
  const getOptions = typeof options === 'function' ? options : async () => options;
  const shopApi = {
    checkout: { getOptions },
    products: { getById: (productId: string) => getProduct(productId) },
  } as unknown as ShopApi;
  vi.mocked(getShopApi).mockResolvedValue(shopApi);
}

const productCatalog = new Map<string, Product>();

function saveCart(products: Array<{ id: string; price: number; quantity?: number }>) {
  for (const { id, price } of products) productCatalog.set(id, buildProduct(id, price));
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    serializeCart(
      products.map(({ id, quantity = 1 }) => ({
        productId: id,
        quantity,
        optionId: null,
        optionLabel: null,
      })),
    ),
  );
}

function renderCartPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>
        <CheckoutProvider>
          <CartProvider>
            <CartPageView />
          </CartProvider>
        </CheckoutProvider>
      </MemberSessionProvider>
    </QueryClientProvider>,
  );
}

async function waitForCartItems(count: number) {
  return screen.findByRole('heading', { name: `주문 가능 상품 (${count})` });
}

function getShippingProgress() {
  return screen.getByRole('progressbar', { name: '무료 배송 기준 달성률' });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  productCatalog.clear();
  configureApi();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CartPageView free shipping progress', () => {
  it('does not show a shipping banner while checkout options are loading', async () => {
    saveCart([{ id: 'loading-options', price: 18_000 }]);
    configureApi(() => new Promise<CheckoutOptions>(() => undefined));
    renderCartPage();

    await waitForCartItems(1);

    expect(screen.queryByRole('region', { name: '무료 배송 혜택' })).not.toBeInTheDocument();
  });

  it('retries a failed options request and shows the banner after it succeeds', async () => {
    const user = userEvent.setup();
    saveCart([{ id: 'failed-options', price: 18_000 }]);
    let attempts = 0;
    configureApi(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('배송 설정을 불러오지 못했습니다.');
      return buildOptions();
    });
    renderCartPage();

    await screen.findByRole('alert');
    await waitForCartItems(1);

    expect(screen.queryByRole('region', { name: '무료 배송 혜택' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    const shippingBanner = await screen.findByRole('region', { name: '무료 배송 혜택' });
    expect(shippingBanner).toHaveClass('border-text-1', 'bg-bg');
    expect(attempts).toBe(2);
  });

  it.each([
    {
      name: 'missing',
      options: {
        shippingFee: 3000,
        deliveryRequests: [],
        shippingMethods: [{ id: 'standard', label: '일반 배송', description: '2~3일' }],
        paymentMethods: [{ id: 'creditCard', label: '신용카드' }],
      },
    },
    { name: 'null', options: { ...buildOptions(), freeShippingThreshold: null } },
    { name: 'negative', options: { ...buildOptions(), freeShippingThreshold: -1 } },
    { name: 'NaN', options: { ...buildOptions(), freeShippingThreshold: Number.NaN } },
    {
      name: 'infinite',
      options: { ...buildOptions(), freeShippingThreshold: Number.POSITIVE_INFINITY },
    },
  ])('treats a $name free shipping threshold as zero shipping', async ({ options }) => {
    saveCart([{ id: `invalid-threshold-${String(options)}`, price: 18_000 }]);
    configureApi(options);
    renderCartPage();

    await waitForCartItems(1);

    expect(screen.queryByRole('region', { name: '무료 배송 혜택' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: '무료 배송 기준 달성률' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /₩18,000 주문하기/ })).toBeEnabled();
    expect(screen.getByText('배송비').parentElement).toHaveTextContent('₩0');
    expect(screen.getByText('결제예정금액').parentElement).toHaveTextContent('₩18,000');
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it.each([
    { name: 'null response', options: null },
    {
      name: 'missing delivery requests',
      options: { ...buildOptions(), deliveryRequests: undefined },
    },
    {
      name: 'missing shipping methods',
      options: { ...buildOptions(), shippingMethods: undefined },
    },
    { name: 'empty shipping methods', options: { ...buildOptions(), shippingMethods: [] } },
    { name: 'missing payment methods', options: { ...buildOptions(), paymentMethods: undefined } },
    { name: 'empty payment methods', options: { ...buildOptions(), paymentMethods: [] } },
    { name: 'malformed payment methods', options: { ...buildOptions(), paymentMethods: [{}] } },
  ])('blocks checkout and exposes retry for a $name', async ({ options }) => {
    saveCart([{ id: `invalid-options-${String(options)}`, price: 18_000 }]);
    configureApi(options);
    renderCartPage();

    await waitForCartItems(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('배송 정보를 확인할 수 없습니다');
    expect(screen.getByRole('button', { name: /주문하기/ })).toBeDisabled();
    expect(screen.getByText('배송비').parentElement).toHaveTextContent('확인 필요');
  });

  it('retries a damaged options response before enabling checkout', async () => {
    const user = userEvent.setup();
    saveCart([{ id: 'damaged-options-retry', price: 18_000 }]);
    let attempts = 0;
    configureApi(async () => {
      attempts += 1;
      return attempts === 1 ? {} : buildOptions();
    });
    renderCartPage();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /주문하기/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /주문하기/ })).toBeEnabled());
    expect(attempts).toBe(2);
  });

  it.each([
    { name: 'zero amount', amount: 0, expectedProgress: '0', expectedRemaining: '₩50,000' },
    {
      name: 'under threshold',
      amount: 20_000,
      expectedProgress: '40',
      expectedRemaining: '₩30,000',
    },
  ])(
    'uses white and black styling for an unmet threshold with $name',
    async ({ amount, expectedProgress, expectedRemaining }) => {
      saveCart([{ id: `unmet-${amount}`, price: amount }]);
      renderCartPage();

      const shippingBanner = await screen.findByRole('region', { name: '무료 배송 혜택' });
      await waitForCartItems(1);

      expect(shippingBanner).toHaveClass('border-text-1', 'bg-bg');
      expect(shippingBanner).not.toHaveClass('border-success', 'bg-success-tint');
      expect(screen.getByText(`${expectedRemaining} 더 담으면 무료배송!`)).toHaveClass(
        'text-text-1',
      );
      expect(screen.getByText(`₩${amount.toLocaleString('ko-KR')} / ₩50,000`)).toHaveClass(
        'text-text-1',
      );
      expect(getShippingProgress()).toHaveAttribute('aria-valuenow', expectedProgress);
      expect(getShippingProgress().firstElementChild).toHaveClass('bg-text-1');
      expect(getShippingProgress().firstElementChild).toHaveClass(
        'transition-[width]',
        'duration-300',
        'motion-reduce:transition-none',
      );
      expect(getShippingProgress()).toHaveClass('bg-bg-subtle');
    },
  );

  it.each([
    { name: 'exactly at the threshold', amount: 50_000 },
    { name: 'above the threshold', amount: 62_000 },
  ])('keeps green styling and caps progress at 100% $name', async ({ amount }) => {
    saveCart([{ id: `met-${amount}`, price: amount }]);
    renderCartPage();

    const shippingBanner = await screen.findByRole('region', { name: '무료 배송 혜택' });
    await waitForCartItems(1);

    expect(shippingBanner).toHaveClass('border-success', 'bg-success-tint');
    expect(screen.getByText('무료 배송 기준을 충족했습니다.')).toHaveClass('text-success');
    expect(screen.getByText(`₩${amount.toLocaleString('ko-KR')} / ₩50,000`)).toHaveClass(
      'text-success',
    );
    expect(getShippingProgress()).toHaveAttribute('aria-valuemin', '0');
    expect(getShippingProgress()).toHaveAttribute('aria-valuemax', '100');
    expect(getShippingProgress()).toHaveAttribute('aria-valuenow', '100');
    expect(getShippingProgress().firstElementChild).toHaveClass('bg-success');
    expect(getShippingProgress().firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('treats a zero threshold as met with full progress', async () => {
    saveCart([{ id: 'zero-threshold', price: 0 }]);
    configureApi(buildOptions(0));
    renderCartPage();

    const shippingBanner = await screen.findByRole('region', { name: '무료 배송 혜택' });
    await waitForCartItems(1);

    expect(shippingBanner).toHaveClass('border-success', 'bg-success-tint');
    expect(screen.getByText('무료 배송 기준을 충족했습니다.')).toBeInTheDocument();
    expect(getShippingProgress()).toHaveAttribute('aria-valuenow', '100');
  });

  it('calculates the free shipping amount from selected products only', async () => {
    const user = userEvent.setup();
    saveCart([
      { id: 'selected-product', price: 26_000 },
      { id: 'unselected-product', price: 26_000 },
    ]);
    renderCartPage();
    await waitForCartItems(2);

    const shippingBanner = await screen.findByRole('region', { name: '무료 배송 혜택' });
    expect(shippingBanner).toHaveTextContent('₩52,000 / ₩50,000');
    expect(shippingBanner).toHaveClass('border-success', 'bg-success-tint');
    expect(shippingBanner).toHaveTextContent('무료 배송 기준을 충족했습니다.');

    await user.click(screen.getByRole('checkbox', { name: '상품 unselected-product 선택' }));

    await waitFor(() => expect(shippingBanner).toHaveTextContent('₩26,000 / ₩50,000'));
    expect(shippingBanner).toHaveClass('border-text-1', 'bg-bg');
    expect(shippingBanner).toHaveTextContent('₩24,000 더 담으면 무료배송!');
    expect(getShippingProgress()).toHaveAttribute('aria-valuenow', '52');

    await user.click(screen.getByRole('checkbox', { name: '상품 unselected-product 선택' }));

    await waitFor(() => expect(shippingBanner).toHaveTextContent('₩52,000 / ₩50,000'));
    expect(shippingBanner).toHaveClass('border-success', 'bg-success-tint');
    expect(shippingBanner).toHaveTextContent('무료 배송 기준을 충족했습니다.');
    expect(getShippingProgress()).toHaveAttribute('aria-valuenow', '100');
  });

  it('does not show a shipping banner while cart products are being restored', async () => {
    saveCart([{ id: 'loading-cart', price: 18_000 }]);
    let resolveProduct: (product: Product) => void = () => undefined;
    const pendingProduct = new Promise<Product>((resolve) => {
      resolveProduct = resolve;
    });
    configureApi(buildOptions(), () => pendingProduct);
    const { container } = renderCartPage();

    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(screen.queryByRole('region', { name: '무료 배송 혜택' })).not.toBeInTheDocument();

    resolveProduct(buildProduct('loading-cart', 18_000));
    await waitForCartItems(1);
  });

  it('does not show a shipping banner when cart restoration fails', async () => {
    saveCart([{ id: 'failed-cart', price: 18_000 }]);
    configureApi(buildOptions(), async () => {
      throw new Error('상품을 복원하지 못했습니다.');
    });
    renderCartPage();

    await screen.findByText('장바구니를 불러오지 못했습니다');

    expect(screen.queryByRole('region', { name: '무료 배송 혜택' })).not.toBeInTheDocument();
  });
});
