import { describe, expect, it } from 'vitest';
import {
  addProductToCart,
  calculateCartTotals,
  CART_MAX_QUANTITY,
  clampCartQuantity,
  groupCartItems,
  removeCartItems,
  updateCartItemQuantity,
} from './cart';
import { buildCartItem, buildProduct } from './test-fixtures';

const orderableProduct = buildProduct({ id: 'p-ok', price: 18000 });
const freeProduct = buildProduct({ id: 'p-free', price: 0 });
const hiddenPriceProduct = buildProduct({ id: 'p-hidden', price: 126000, priceVisible: false });
const soldOutProduct = buildProduct({ id: 'p-soldout', price: 32000, stockStatus: 'soldOut' });

describe('groupCartItems', () => {
  it('금액 미표시·품절 상품을 "주문할 수 없는 상품" 그룹으로 나눕니다', () => {
    const cartItems = [
      buildCartItem(orderableProduct),
      buildCartItem(hiddenPriceProduct),
      buildCartItem(freeProduct),
      buildCartItem(soldOutProduct),
    ];
    const { orderableItems, unorderableItems } = groupCartItems(cartItems);
    expect(orderableItems.map((cartItem) => cartItem.productId)).toEqual(['p-ok', 'p-free']);
    expect(unorderableItems.map(({ cartItem, reason }) => [cartItem.productId, reason])).toEqual([
      ['p-hidden', 'priceHidden'],
      ['p-soldout', 'soldOut'],
    ]);
  });

  it('금액 미표시이면서 품절이면 품절을 이유로 표시합니다', () => {
    const product = buildProduct({ id: 'p-both', priceVisible: false, stockStatus: 'soldOut' });
    expect(groupCartItems([buildCartItem(product)]).unorderableItems[0]?.reason).toBe('soldOut');
  });
});

describe('calculateCartTotals', () => {
  it('주문 가능한 항목만 합산하고 ₩0 상품도 주문 가능으로 셉니다', () => {
    const cartItems = [
      buildCartItem(orderableProduct, 3),
      buildCartItem(freeProduct, 2),
      buildCartItem(hiddenPriceProduct, 5),
    ];
    expect(calculateCartTotals(cartItems)).toEqual({
      orderableCount: 2,
      selectedOrderableCount: 2,
      excludedCount: 1,
      productTotal: 54000,
    });
  });

  it('선택한 항목만 합산합니다', () => {
    const cartItems = [buildCartItem(orderableProduct, 2), buildCartItem(freeProduct)];
    const cartTotals = calculateCartTotals(cartItems, new Set(['cart-p-free']));
    expect(cartTotals.productTotal).toBe(0);
    expect(cartTotals.selectedOrderableCount).toBe(1);
  });

  it('주문 가능 항목이 없으면 합계는 0입니다', () => {
    expect(calculateCartTotals([buildCartItem(hiddenPriceProduct)]).productTotal).toBe(0);
  });
});

describe('수량 변경', () => {
  it('수량을 1~최대 범위의 정수로 맞춥니다', () => {
    expect(clampCartQuantity(0)).toBe(1);
    expect(clampCartQuantity(2.7)).toBe(2);
    expect(clampCartQuantity(Number.NaN)).toBe(1);
    expect(clampCartQuantity(CART_MAX_QUANTITY + 5)).toBe(CART_MAX_QUANTITY);
  });

  it('같은 상품을 다시 담으면 수량을 더합니다', () => {
    const createId = () => 'new-id';
    const onceAdded = addProductToCart([], orderableProduct, 1, createId);
    const twiceAdded = addProductToCart(onceAdded, orderableProduct, 2, createId);
    expect(twiceAdded).toHaveLength(1);
    expect(twiceAdded[0]?.quantity).toBe(3);
  });

  it('원본 배열을 바꾸지 않습니다', () => {
    const cartItems = [buildCartItem(orderableProduct)];
    const updatedItems = updateCartItemQuantity(cartItems, 'cart-p-ok', 4);
    expect(cartItems[0]?.quantity).toBe(1);
    expect(updatedItems[0]?.quantity).toBe(4);
  });

  it('선택한 항목을 지웁니다', () => {
    const cartItems = [buildCartItem(orderableProduct), buildCartItem(freeProduct)];
    expect(
      removeCartItems(cartItems, new Set(['cart-p-ok'])).map((cartItem) => cartItem.id),
    ).toEqual(['cart-p-free']);
  });
});
