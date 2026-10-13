import type { CheckoutOptions } from '../types';

/** 개발용 주문서 선택지입니다. 화면은 이 값을 사용하고 real API는 별도 서버 정책을 적용해야 합니다. */
export const mockCheckoutOptions: CheckoutOptions = {
  freeShippingThreshold: 50000,
  shippingFee: 3000,
  deliveryRequests: [
    { id: 'none', label: '배송 요청사항을 선택해 주세요' },
    { id: 'call', label: '배송 전에 연락 바랍니다' },
    { id: 'door', label: '문 앞에 놓아 주세요' },
    { id: 'security', label: '경비실에 맡겨 주세요' },
  ],
  shippingMethods: [{ id: 'standard', label: '일반 배송', description: '2~3일' }],
  paymentMethods: [
    { id: 'creditCard', label: '신용카드' },
    { id: 'bankTransfer', label: '계좌이체' },
    { id: 'virtualAccount', label: '가상계좌' },
    { id: 'simpleA', label: '간편결제 A' },
    { id: 'simpleB', label: '간편결제 B' },
    { id: 'mobile', label: '휴대폰 결제' },
  ],
};
