'use client';

import type {
  Address,
  Claim,
  Coupon,
  CouponOffer,
  BuyerSessionMember,
  Order,
  Point,
  Product,
} from '@eum/api/types';

export type MyPageDataScope =
  | 'dashboard'
  | 'orders'
  | 'order-detail'
  | 'claims'
  | 'claim-new'
  | 'wishlist'
  | 'recent'
  | 'coupons'
  | 'points'
  | 'profile'
  | 'profile-edit'
  | 'addresses';

export interface MyPageData {
  member: BuyerSessionMember | null;
  orders: Order[];
  claims: Claim[];
  coupons: Coupon[];
  couponOffers: CouponOffer[];
  points: Point[];
  addresses: Address[];
  products: Product[];
  unavailableProductIds: string[];
  loadWarnings: string[];
}

/** 컬렉션 화면은 현재 활성 탭의 상품만 조회합니다. */
export function getCollectionProductIds(
  scope: MyPageDataScope,
  wishlistIds: string[],
  recentIds: string[],
) {
  if (scope === 'wishlist') return wishlistIds;
  if (scope === 'recent') return recentIds;
  return [];
}

export function formatMyPageDate(dateValue: string, options: Intl.DateTimeFormatOptions = {}) {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(parsedDate);
}

export function formatMyPagePrice(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

export { useMyPageData } from './use-mypage-query';
