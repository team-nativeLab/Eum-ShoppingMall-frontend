import type { Faq, Inquiry, Notice, Quote } from '../types';

/** 목 공지사항 */
export const mockNotices: Notice[] = [
  {
    id: 'ntc-001',
    title: '추석 연휴 배송 일정 안내',
    body: '연휴 기간 주문은 연휴 이후 순차 출고합니다.',
    isPinned: true,
    publishedAt: '2026-09-20T09:00:00+09:00',
  },
  {
    id: 'ntc-002',
    title: '개인정보 처리방침 개정 안내',
    body: '개정된 처리방침은 공지일로부터 7일 후 시행합니다.',
    isPinned: false,
    publishedAt: '2026-08-11T09:00:00+09:00',
  },
];

/** 목 FAQ */
export const mockFaqs: Faq[] = [
  {
    id: 'faq-001',
    category: '주문·결제',
    question: '가격이 "구매 불가"로 보이는 상품은 어떻게 구매합니까?',
    answer: '견적 문의를 남겨 주시면 담당자가 연락드립니다.',
  },
  {
    id: 'faq-002',
    category: '배송',
    question: '배송은 얼마나 걸립니까?',
    answer: '결제 완료 후 영업일 기준 2~3일이 걸립니다.',
  },
];

/** 목 견적 문의. 상태 다섯 가지를 모두 담습니다. */
export const mockQuotes: Quote[] = [
  {
    id: 'qt-001',
    title: '현장 안전모 200개 견적',
    companyName: '예시건설',
    contactName: '박담당',
    status: 'received',
    requestedAt: '2026-10-12T09:10:00+09:00',
    memberId: 'mem-001',
  },
  {
    id: 'qt-002',
    title: '추락 방지망 설치 문의',
    companyName: '샘플토건',
    contactName: '최현장',
    status: 'consulting',
    requestedAt: '2026-10-09T13:20:00+09:00',
    memberId: 'mem-002',
  },
  {
    id: 'qt-003',
    title: '소화기 일괄 교체',
    companyName: '예시건설',
    contactName: '박담당',
    status: 'quoteSent',
    requestedAt: '2026-10-02T15:00:00+09:00',
    memberId: 'mem-001',
  },
  {
    id: 'qt-004',
    title: 'CCTV 경고 표지 30개',
    companyName: '테스트산업',
    contactName: '정안전',
    status: 'completed',
    requestedAt: '2026-09-15T10:00:00+09:00',
    memberId: null,
  },
  {
    id: 'qt-005',
    title: '안전화 사이즈별 견적',
    companyName: '샘플토건',
    contactName: '최현장',
    status: 'canceled',
    requestedAt: '2026-09-01T11:30:00+09:00',
    memberId: 'mem-002',
  },
];

/** 목 1:1 문의 */
export const mockInquiries: Inquiry[] = [
  {
    id: 'inq-001',
    memberId: 'mem-001',
    title: '세금계산서 발행 문의',
    body: '주문 20261001-0001 건 세금계산서 발행을 요청합니다.',
    status: 'answered',
    createdAt: '2026-10-02T09:00:00+09:00',
    answer: '요청하신 세금계산서를 발행했습니다.',
  },
];
