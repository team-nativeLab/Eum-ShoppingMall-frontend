import type { CompanyInfo } from '../types';

/** 목 사업자 정보. 실제 값은 서버(관리자 설정)에서 오며, 지금은 디자인 자리표시 값을 씁니다. */
export const mockCompanyInfo: CompanyInfo = {
  companyName: '이음산업건설',
  representative: '000',
  businessRegistrationNumber: '000-00-00000',
  mailOrderSalesNumber: '제0000-서울00-0000호',
  address: '서울특별시 00구 00로 00',
  email: 'info@example.com',
  quoteEmail: 'quote@example.com',
  privacyOfficer: '000',
  customerCenterPhone: '0000-0000',
  customerCenterTel: '00000000',
  customerCenterHours: '평일 00:00 – 00:00 (주말·공휴일 휴무)',
};
