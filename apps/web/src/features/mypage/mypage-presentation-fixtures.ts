/** Display-only rows used to keep My Page layouts visible in mock mode. */
export const CLAIM_LAYOUT_SAMPLES = [
  {
    key: 'claim-layout-requested',
    type: 'return',
    status: 'requested',
    statusLabel: '반품 요청',
    action: '신청 철회',
    refund: '₩00,000',
  },
  {
    key: 'claim-layout-recovery',
    type: 'return',
    status: 'processing',
    statusLabel: '회수중',
    action: '신청 상세',
    refund: '₩00,000',
  },
  {
    key: 'claim-layout-cancelled',
    type: 'cancel',
    status: 'completed',
    statusLabel: '취소 완료',
    action: '신청 상세',
    refund: '₩00,000',
  },
  {
    key: 'claim-layout-rejected',
    type: 'return',
    status: 'rejected',
    statusLabel: '반려',
    action: '반려 사유',
    refund: '₩00,000',
  },
] as const;

export const COUPON_LAYOUT_SAMPLES = [
  {
    key: 'coupon-layout-rate-a',
    discount: '00%',
    name: '쿠폰명',
    minimum: '₩00,000',
    date: '0000.00.00',
    scope: '적용 상품',
  },
  {
    key: 'coupon-layout-amount-a',
    discount: '₩0,000',
    name: '쿠폰명',
    minimum: '₩00,000',
    date: '0000.00.00',
    scope: '적용 상품',
  },
  {
    key: 'coupon-layout-rate-b',
    discount: '00%',
    name: '쿠폰명',
    minimum: '₩00,000',
    date: '0000.00.00',
    scope: '전 상품',
  },
  {
    key: 'coupon-layout-shipping',
    discount: '₩0,000',
    name: '배송비 쿠폰',
    minimum: '₩00,000',
    date: '0000.00.00',
    scope: '배송비',
  },
  {
    key: 'coupon-layout-rate-c',
    discount: '00%',
    name: '쿠폰명',
    minimum: '₩00,000',
    date: '0000.00.00',
    scope: '전 상품',
  },
] as const;

export const POINT_LAYOUT_SAMPLES = [
  {
    key: 'order-earned-a',
    description: '주문 적립',
    bucket: 'earned',
    amount: '+0원',
    order: '0000000000',
    expires: '0000.00.00',
  },
  {
    key: 'order-spent-a',
    description: '주문 사용',
    bucket: 'spent',
    amount: '-0원',
    order: '0000000000',
    expires: '-',
  },
  {
    key: 'event-earned',
    description: '이벤트 적립',
    bucket: 'earned',
    amount: '+0원',
    order: '-',
    expires: '0000.00.00',
  },
  {
    key: 'expired-points',
    description: '기간 만료 소멸',
    bucket: 'expired',
    amount: '-0원',
    order: '-',
    expires: '-',
  },
  {
    key: 'order-earned-b',
    description: '주문 적립',
    bucket: 'earned',
    amount: '+0원',
    order: '0000000000',
    expires: '0000.00.00',
  },
  {
    key: 'cancel-return',
    description: '주문 취소 환원',
    bucket: 'earned',
    amount: '+0원',
    order: '0000000000',
    expires: '0000.00.00',
  },
  {
    key: 'order-spent-b',
    description: '주문 사용',
    bucket: 'spent',
    amount: '-0원',
    order: '0000000000',
    expires: '-',
  },
] as const;

export const ADDRESS_LAYOUT_SAMPLE_KEYS = ['layout-address-1', 'layout-address-2'] as const;

export const ORDER_LAYOUT_SAMPLE = {
  date: '0000.00.00',
  orderNumber: '0000000000',
  productName: '제품명',
  unitPrice: '₩00,000',
  totalPrice: '₩00,000',
  quantity: '1개',
} as const;

export const CLAIM_LAYOUT_SAMPLE_DETAILS = {
  date: '0000.00.00',
  orderNumber: '0000000000',
  productName: '제품명',
  optionName: '옵션명',
  quantity: '0개',
} as const;

export const ADDRESS_LAYOUT_SAMPLE = {
  label: '배송지명',
  recipientName: '홍길동',
  postalAddress: '(00000) 주소 상세주소',
  phone: '010-0000-0000',
} as const;
