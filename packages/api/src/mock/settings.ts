import type { AdminShopSettings } from '../types';

/** 합성 운영 정책. 저장은 같은 ShopApi mock 인스턴스와 checkout 응답에만 반영됩니다. */
export const mockAdminShopSettings: AdminShopSettings = {
  baseShippingFee: 3000,
  baseFeeMode: 'customer',
  freeShippingEnabled: true,
  freeShippingThreshold: 50000,
  freeShippingScope: 'all',
  remoteFeeEnabled: true,
  jejuFee: 0,
  islandFee: 0,
  returnFee: 0,
  exchangeFee: 0,
  combineReturnShipping: true,
  businessDiscountEnabled: false,
  businessDiscountRate: 0,
  businessDiscountScope: 'direct',
  businessCouponStacking: false,
  firstPurchaseEnabled: false,
  firstPurchaseBenefitType: 'rate',
  firstPurchaseBenefitValue: 0,
  firstPurchaseMaxDiscount: 0,
  firstPurchaseMinimumOrder: 0,
  firstPurchasePaymentScope: 'all',
};
