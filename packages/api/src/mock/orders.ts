import type { Claim, Order } from '../types';
import { mockAddresses } from './addresses';

const defaultAddress = mockAddresses[0]!;

/** 목 주문 */
export const mockOrders: Order[] = [
  {
    id: 'ord-001',
    orderNumber: '20261001-0001',
    orderedAt: '2026-10-01T10:12:00+09:00',
    status: 'delivered',
    memberId: 'mem-001',
    lines: [
      {
        productId: 'prd-1001',
        productName: 'ABS 안전모 (내관 조절형)',
        unitPrice: 18000,
        quantity: 5,
      },
      { productId: 'prd-1004', productName: '코팅 장갑 10켤레', unitPrice: 0, quantity: 1 },
    ],
    productTotal: 90000,
    shippingFee: 3000,
    discountTotal: 5000,
    pointUsed: 1000,
    paymentTotal: 87000,
    shippingAddress: defaultAddress,
  },
  {
    id: 'ord-002',
    orderNumber: '20261010-0002',
    orderedAt: '2026-10-10T16:40:00+09:00',
    status: 'shipping',
    memberId: 'mem-001',
    lines: [
      { productId: 'prd-1002', productName: '경량 안전화 4인치', unitPrice: 54000, quantity: 2 },
    ],
    productTotal: 108000,
    shippingFee: 0,
    discountTotal: 0,
    pointUsed: 0,
    paymentTotal: 108000,
    shippingAddress: defaultAddress,
  },
];

/** 목 취소·반품·교환 신청 */
export const mockClaims: Claim[] = [
  {
    id: 'clm-001',
    orderId: 'ord-001',
    type: 'exchange',
    status: 'processing',
    reason: '사이즈 교환',
    requestedAt: '2026-10-04T11:00:00+09:00',
  },
];
