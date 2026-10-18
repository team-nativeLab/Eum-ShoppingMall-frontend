import type { AdminAddress } from '../types';

/** 목 배송지 */
export const mockAddresses: AdminAddress[] = [
  {
    id: 'addr-001',
    memberId: 'mem-001',
    label: '본사',
    recipientName: '김구매',
    phone: '010-0000-0001',
    postalCode: '00000',
    address1: '서울특별시 예시구 예시로 1',
    address2: '3층',
    isDefault: true,
  },
  {
    id: 'addr-002',
    memberId: 'mem-001',
    label: '현장 사무소',
    recipientName: '이현장',
    phone: '010-0000-0002',
    postalCode: '00001',
    address1: '경기도 예시시 현장길 22',
    address2: '가설 사무실',
    isDefault: false,
  },
];
