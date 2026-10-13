import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@eum/api/errors';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@eum/api/types';
import { CartProvider, useCart } from './cart-context';
import { CART_STORAGE_KEY, serializeCart } from './cart-storage';

const { getProductById } = vi.hoisted(() => ({ getProductById: vi.fn() }));

vi.mock('@/lib/shop-api', () => ({
  getShopApi: async () => ({ products: { getById: getProductById } }),
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
    retryRestore,
  } = useCart();
  return (
    <div>
      <p>{hasRestored ? '복원 완료' : '복원 중'}</p>
      <p>{restoreError ? '복원 실패' : '복원 정상'}</p>
      <p>수량 {totalQuantity}</p>
      <p>합계 {cartTotals.productTotal}</p>
      <p>주문 불가 {cartGroups.unorderableItems.length}</p>
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
      <button type="button" onClick={retryRestore}>
        복원 다시 시도
      </button>
    </div>
  );
}

const renderCart = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <CartProbe />
      </CartProvider>
    </QueryClientProvider>,
  );
};

async function waitForRestore() {
  await screen.findByText('복원 완료');
}

beforeEach(() => {
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
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}').cartItems).toEqual([
      { productId: 'p-visible', quantity: 1, optionId: null, optionLabel: null },
    ]);
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
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: otherTabValue }),
      );
    });
    expect(await screen.findByText('수량 4')).toBeInTheDocument();
    expect(screen.getByText('주문 불가 1')).toBeInTheDocument();
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
