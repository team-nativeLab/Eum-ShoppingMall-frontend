import type { Product } from './types';

/** 금액 미표시 상품의 가격 자리에 보여 주는 문구 */
export const PRICE_HIDDEN_LABEL = '구매 불가';

const KRW_NUMBER_FORMAT = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

/** 원 단위 금액을 "₩12,000" 형식으로 바꾸는 함수. ₩0도 그대로 표시합니다. */
export function formatKrw(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₩${KRW_NUMBER_FORMAT.format(Math.abs(amount))}`;
}

/** 가격 자리에 무엇을 보여 줄지 */
export type PriceDisplay =
  | { isPriceVisible: true; text: string; listPriceText: string | null }
  | { isPriceVisible: false; text: typeof PRICE_HIDDEN_LABEL; listPriceText: null };

type PricedProduct = Pick<Product, 'price' | 'listPrice' | 'priceVisible'>;

/**
 * 상품의 금액 표시 토글(priceVisible)에 따라 가격 표시 문구를 정하는 함수.
 * priceVisible과 price는 독립입니다. price가 0이어도 표시 상태면 "₩0"을 보여 줍니다.
 */
export function getPriceDisplay(product: PricedProduct): PriceDisplay {
  if (!product.priceVisible) {
    return { isPriceVisible: false, text: PRICE_HIDDEN_LABEL, listPriceText: null };
  }
  const hasDiscount = product.listPrice !== null && product.listPrice > product.price;
  return {
    isPriceVisible: true,
    text: formatKrw(product.price),
    listPriceText: hasDiscount && product.listPrice !== null ? formatKrw(product.listPrice) : null,
  };
}

type PurchasableProduct = Pick<Product, 'priceVisible' | 'stockStatus'>;

/** 바로 구매·주문이 가능한지. 금액 미표시이거나 품절이면 불가 */
export function canBuyNow(product: PurchasableProduct): boolean {
  return product.priceVisible && product.stockStatus === 'inStock';
}

/** 장바구니에 담을 수 있는지. 금액 미표시 상품도 담을 수 있고, 품절만 막습니다. */
export function canAddToCart(product: PurchasableProduct): boolean {
  return product.stockStatus === 'inStock';
}
