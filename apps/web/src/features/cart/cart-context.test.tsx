import type { Product } from '@eum/api/types';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from './cart-context';
import { CART_STORAGE_KEY, serializeCart } from './cart-storage';

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
};
const hiddenProduct: Product = {
  ...visibleProduct,
  id: 'p-hidden',
  name: '미표시 상품',
  priceVisible: false,
};

// 장바구니 상태를 화면에 드러내는 테스트용 소비자
function CartProbe() {
  const { cartGroups, cartTotals, totalQuantity, addToCart, hasRestored } = useCart();
  return (
    <div>
      <p>{hasRestored ? '복원 완료' : '복원 중'}</p>
      <p>수량 {totalQuantity}</p>
      <p>합계 {cartTotals.productTotal}</p>
      <p>주문 불가 {cartGroups.unorderableItems.length}</p>
      <button type="button" onClick={() => addToCart(visibleProduct, 2)}>
        표시 상품 담기
      </button>
      <button type="button" onClick={() => addToCart(hiddenProduct)}>
        미표시 상품 담기
      </button>
    </div>
  );
}

const renderCart = () =>
  render(
    <CartProvider>
      <CartProbe />
    </CartProvider>,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CartProvider', () => {
  it('localStorage 쓰기가 실패해도 메모리 상태로 계속 동작합니다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    renderCart();
    await screen.findByText('복원 완료');
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    expect(screen.getByText('수량 2')).toBeInTheDocument();
  });

  it('다른 탭에서 저장소를 비우면(key=null) 장바구니도 비웁니다', async () => {
    renderCart();
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
    });
    expect(await screen.findByText('수량 0')).toBeInTheDocument();
  });

  it('담은 상품을 그룹으로 나누고 주문 가능 항목만 합산합니다', async () => {
    renderCart();
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    await userEvent.click(screen.getByRole('button', { name: '미표시 상품 담기' }));
    expect(screen.getByText('수량 3')).toBeInTheDocument();
    expect(screen.getByText('합계 36000')).toBeInTheDocument();
    expect(screen.getByText('주문 불가 1')).toBeInTheDocument();
  });

  it('마운트 후 localStorage에서 복원하고 변경을 저장합니다', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([
        { id: 'cart-p-visible', productId: 'p-visible', quantity: 1, product: visibleProduct },
      ]),
    );
    renderCart();
    await waitFor(() => expect(screen.getByText('수량 1')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '표시 상품 담기' }));
    const storedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}');
    expect(storedCart.cartItems[0].quantity).toBe(3);
  });

  it('다른 탭의 storage 이벤트로 장바구니를 맞춥니다', async () => {
    renderCart();
    const otherTabValue = serializeCart([
      { id: 'cart-p-hidden', productId: 'p-hidden', quantity: 4, product: hiddenProduct },
    ]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: otherTabValue }),
      );
    });
    expect(await screen.findByText('수량 4')).toBeInTheDocument();
    expect(screen.getByText('주문 불가 1')).toBeInTheDocument();
  });

  it('깨진 저장 값은 빈 장바구니로 시작합니다', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{oops');
    renderCart();
    await waitFor(() => expect(screen.getByText('수량 0')).toBeInTheDocument());
  });
});
