import type { AdminCoupon, AdminPoint, Coupon, Point } from '../types';

/** 목 쿠폰 */
export const mockCoupons: Coupon[] = [
  {
    id: 'cpn-001',
    adminCouponId: 'coupon-demo-001',
    name: '신규 회원 5천원 할인',
    discountType: 'amount',
    discountValue: 5000,
    minOrderAmount: 50000,
    expiresAt: '2026-12-31T23:59:59+09:00',
    isUsed: false,
  },
  {
    id: 'cpn-002',
    adminCouponId: 'coupon-demo-002',
    name: '안전화 10% 할인',
    discountType: 'rate',
    discountValue: 10,
    minOrderAmount: 30000,
    expiresAt: '2026-11-30T23:59:59+09:00',
    isUsed: true,
  },
];

/** 합성 운영 쿠폰 카탈로그. 개인 보유 쿠폰과 별도 상태입니다. */
export const mockAdminCoupons: AdminCoupon[] = [
  {
    id: 'coupon-demo-001',
    name: '신규 가입 쿠폰',
    code: 'DEMOJOIN10',
    benefitType: 'rate',
    benefitValue: 10,
    maxDiscountAmount: 5000,
    minimumOrderAmount: 30000,
    target: 'all',
    issueMethod: 'automatic',
    productScope: 'all',
    issueLimit: 1000,
    allowStacking: false,
    validityMode: 'period',
    validityDays: null,
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    issuedCount: 0,
    usedCount: 0,
    status: 'active',
    notice: '',
  },
  {
    id: 'coupon-demo-002',
    name: '사업자 첫 주문',
    code: 'DEMOBIZ',
    benefitType: 'amount',
    benefitValue: 5000,
    maxDiscountAmount: 5000,
    minimumOrderAmount: 100000,
    target: 'business',
    issueMethod: 'download',
    productScope: 'category',
    issueLimit: 300,
    allowStacking: false,
    validityMode: 'period',
    validityDays: null,
    startsAt: '2026-11-01',
    endsAt: '2026-12-31',
    issuedCount: 0,
    usedCount: 0,
    status: 'scheduled',
    notice: '',
  },
  {
    id: 'coupon-demo-003',
    name: '여름 안전용품',
    code: 'DEMOSUMMER',
    benefitType: 'rate',
    benefitValue: 5,
    maxDiscountAmount: 10000,
    minimumOrderAmount: 0,
    target: 'all',
    issueMethod: 'code',
    productScope: 'products',
    issueLimit: null,
    allowStacking: true,
    validityMode: 'period',
    validityDays: null,
    startsAt: '2026-06-01',
    endsAt: '2026-08-31',
    issuedCount: 0,
    usedCount: 0,
    status: 'ended',
    notice: '',
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

export const mockAdminPoints: AdminPoint[] = mockPoints.map((point) => ({
  ...point,
  memberId: 'mem-001',
  reason: point.description,
}));
