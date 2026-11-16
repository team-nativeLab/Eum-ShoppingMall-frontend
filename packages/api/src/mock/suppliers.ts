import type { AdminSupplier } from '../types';

/** 발주처 관리 화면의 목 데이터입니다. 운영 주소는 실제 서버에서 받아야 합니다. */
export const mockSuppliers: AdminSupplier[] = [
  {
    id: 'sup-001',
    companyName: '안전용품 공급사',
    contactName: '담당자',
    contactPhone: '02-0000-0000',
    contactEmail: 'contact@example.com',
    orderChannel: 'email',
    orderEmail: 'orders@example.com',
    orderFax: null,
    address: '',
    memo: '',
  },
];
