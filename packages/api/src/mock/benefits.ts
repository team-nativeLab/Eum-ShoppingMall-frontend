import type { Coupon, Point } from '../types';

/** 목 쿠폰 */
export const mockCoupons: Coupon[] = [
  {
    id: 'cpn-001',
    name: '신규 회원 5천원 할인',
    discountType: 'amount',
    discountValue: 5000,
    minOrderAmount: 50000,
    expiresAt: '2026-12-31T23:59:59+09:00',
    isUsed: false,
  },
  {
    id: 'cpn-002',
    name: '안전화 10% 할인',
    discountType: 'rate',
    discountValue: 10,
    minOrderAmount: 30000,
    expiresAt: '2026-11-30T23:59:59+09:00',
    isUsed: true,
  },
];

/** 목 적립금 내역 */
export const mockPoints: Point[] = [
  {
    id: 'pt-001',
    description: '회원가입 적립',
    amount: 3000,
    occurredAt: '2026-03-02T09:00:00+09:00',
    expiresAt: '2027-03-02T23:59:59+09:00',
  },
  {
    id: 'pt-002',
    description: '주문 사용',
    amount: -1000,
    occurredAt: '2026-10-01T10:12:00+09:00',
    expiresAt: null,
  },
];
