import { describe, expect, it } from 'vitest';
import {
  addProductToCart,
  calculateCartTotals,
  CART_MAX_QUANTITY,
  clampCartQuantity,
  createCartOptionId,
  groupCartItems,
  resolveCartOption,
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
    const onceAdded = addProductToCart([], orderableProduct, 1, null, null, createId);
    const twiceAdded = addProductToCart(onceAdded, orderableProduct, 2, null, null, createId);
    expect(twiceAdded).toHaveLength(1);
    expect(twiceAdded[0]?.quantity).toBe(3);
  });

  it('같은 상품이라도 선택 옵션이 다르면 별도 줄로 보관합니다', () => {
    const createId = () => 'new-id';
    const whiteItem = addProductToCart([], orderableProduct, 1, 'white', '백색', createId);
    const yellowItem = addProductToCart(
      whiteItem,
      orderableProduct,
      2,
      'yellow',
      '노란색',
      () => 'yellow-id',
    );
    expect(yellowItem.map(({ optionId, quantity }) => [optionId, quantity])).toEqual([
      ['white', 1],
      ['yellow', 2],
    ]);
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

const optionProduct = buildProduct({
  id: 'p-option',
  price: 20000,
  options: [
    {
      id: 'type',
      label: '형태',
      required: true,
      choices: [
        { id: 'wall', label: '벽걸이형', priceDelta: 0 },
        { id: 'stand', label: '스탠드형', priceDelta: 3000 },
      ],
    },
    {
      id: 'color',
      label: '색상',
      required: false,
      choices: [{ id: 'red', label: '빨강', priceDelta: 500 }],
    },
  ],
});

describe('장바구니 옵션 해석', () => {
  it('옵션 식별자를 만들고 최신 옵션 문구와 추가금 합계로 해석합니다', () => {
    const cartOptionId = createCartOptionId([
      { optionId: 'type', choiceId: 'stand' },
      { optionId: 'color', choiceId: 'red' },
    ]);
    expect(cartOptionId).toBe('type:stand|color:red');
    expect(resolveCartOption(optionProduct, cartOptionId)).toEqual({
      isAvailable: true,
      optionLabel: '형태: 스탠드형 / 색상: 빨강',
      priceDelta: 3500,
    });
    expect(createCartOptionId([])).toBeNull();
  });

  it('사라진 옵션·선택지, 빠진 필수 옵션, 깨진 식별자는 주문할 수 없습니다', () => {
    expect(resolveCartOption(optionProduct, 'type:floor').isAvailable).toBe(false);
    expect(resolveCartOption(optionProduct, 'size:xl|type:wall').isAvailable).toBe(false);
    expect(resolveCartOption(optionProduct, 'color:red').isAvailable).toBe(false);
    expect(resolveCartOption(optionProduct, null).isAvailable).toBe(false);
    expect(resolveCartOption(optionProduct, 'white').isAvailable).toBe(false);
  });

  it('옵션이 없는 상품은 옵션 없이 주문할 수 있습니다', () => {
    expect(resolveCartOption(orderableProduct, null)).toEqual({
      isAvailable: true,
      optionLabel: null,
      priceDelta: 0,
    });
  });

  it('합계에 옵션 추가금을 반영하고 옵션이 사라진 줄은 주문 불가 그룹으로 보냅니다', () => {
    const standItem = { ...buildCartItem(optionProduct, 2), optionId: 'type:stand' };
    const removedOptionItem = {
      ...buildCartItem(optionProduct),
      id: 'cart-removed',
      optionId: 'type:floor',
    };
    const { unorderableItems } = groupCartItems([standItem, removedOptionItem]);
    expect(unorderableItems).toEqual([
      { cartItem: removedOptionItem, reason: 'optionUnavailable' },
    ]);
    expect(calculateCartTotals([standItem, removedOptionItem])).toMatchObject({
      orderableCount: 1,
      excludedCount: 1,
      productTotal: 46000,
    });
  });
});
