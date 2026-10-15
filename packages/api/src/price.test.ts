import { describe, expect, it } from 'vitest';
import { canAddToCart, canBuyNow, formatKrw, getPriceDisplay, PRICE_HIDDEN_LABEL } from './price';
import { buildProduct } from './test-fixtures';

describe('formatKrw', () => {
  it('천 단위 구분 기호와 ₩를 붙입니다', () => {
    expect(formatKrw(1234567)).toBe('₩1,234,567');
  });

  it('₩0도 그대로 표시합니다', () => {
    expect(formatKrw(0)).toBe('₩0');
  });

  it('음수는 부호를 앞에 붙입니다', () => {
    expect(formatKrw(-3000)).toBe('-₩3,000');
  });
});

describe('getPriceDisplay — 금액 표시 토글', () => {
  it('금액 표시 상품은 가격을 보여 줍니다', () => {
    const priceDisplay = getPriceDisplay(buildProduct({ price: 18000 }));
    expect(priceDisplay).toEqual({
      isPriceVisible: true,
      text: '₩18,000',
      listPriceText: null,
      discountRate: null,
      discountRateLabel: null,
    });
  });

  it('금액 표시 상품의 가격이 0이어도 ₩0을 보여 줍니다', () => {
    expect(getPriceDisplay(buildProduct({ price: 0 })).text).toBe('₩0');
  });

  it('금액 미표시 상품은 가격 값과 관계없이 "구매 불가"를 보여 줍니다', () => {
    const priceDisplay = getPriceDisplay(buildProduct({ price: 126000, priceVisible: false }));
    expect(priceDisplay).toEqual({
      isPriceVisible: false,
      text: PRICE_HIDDEN_LABEL,
      listPriceText: null,
      discountRate: null,
      discountRateLabel: null,
    });
    expect(PRICE_HIDDEN_LABEL).toBe('구매 불가');
  });

  it('구매자 응답에 가격이 null이면 값을 노출하거나 구매를 허용하지 않습니다', () => {
    const hiddenProduct = buildProduct({ price: null, listPrice: null, priceVisible: true });
    expect(getPriceDisplay(hiddenProduct).isPriceVisible).toBe(false);
    expect(canBuyNow(hiddenProduct)).toBe(false);
  });

  it('정가가 판매가보다 높을 때만 정가를 보여 줍니다', () => {
    expect(getPriceDisplay(buildProduct({ price: 18000, listPrice: 22000 }))).toMatchObject({
      listPriceText: '₩22,000',
      discountRate: 18,
      discountRateLabel: '18%',
    });
    expect(getPriceDisplay(buildProduct({ price: 18000, listPrice: 18000 }))).toMatchObject({
      listPriceText: null,
      discountRate: null,
      discountRateLabel: null,
    });
  });

  it('할인율은 정수로 내림하고 가격 비공개 상품에는 제공하지 않습니다', () => {
    expect(getPriceDisplay(buildProduct({ price: 10560, listPrice: 20900 })).discountRate).toBe(49);
    expect(
      getPriceDisplay(buildProduct({ price: 10560, listPrice: 20900 })).discountRateLabel,
    ).toBe('49%');
    expect(
      getPriceDisplay(buildProduct({ price: 10560, listPrice: 20900, priceVisible: false }))
        .discountRate,
    ).toBeNull();
  });

  it('labels a positive discount below one percent without displaying a false zero percent', () => {
    const priceDisplay = getPriceDisplay(buildProduct({ price: 9999, listPrice: 10000 }));

    expect(priceDisplay.discountRate).toBe(0);
    expect(priceDisplay.discountRateLabel).toBe('<1%');
    expect(getPriceDisplay(buildProduct({ price: 9900, listPrice: 10000 })).discountRateLabel).toBe(
      '1%',
    );
  });
});

describe('구매 가능 규칙', () => {
  it('금액 미표시 상품은 바로 구매할 수 없지만 장바구니에는 담을 수 있습니다', () => {
    const hiddenPriceProduct = buildProduct({ priceVisible: false });
    expect(canBuyNow(hiddenPriceProduct)).toBe(false);
    expect(canAddToCart(hiddenPriceProduct)).toBe(true);
  });

  it('품절 상품은 구매도 담기도 할 수 없습니다', () => {
    const soldOutProduct = buildProduct({ stockStatus: 'soldOut' });
    expect(canBuyNow(soldOutProduct)).toBe(false);
    expect(canAddToCart(soldOutProduct)).toBe(false);
  });

  it('금액 표시·재고 있음이면 바로 구매할 수 있습니다', () => {
    expect(canBuyNow(buildProduct())).toBe(true);
  });
});
