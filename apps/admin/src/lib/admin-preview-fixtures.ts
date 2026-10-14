export interface AdminWithdrawnMemberFixture {
  id: string;
  memberNumber: string;
  name: string;
  email: string;
  phone: string;
  memberType: '개인' | '사업자';
  withdrawalType: '본인 탈퇴' | '강제 탈퇴';
  reason: string;
  withdrawnAt: string;
  retentionUntil: string;
  processedBy: string;
  businessName: string;
  detailedMemo: string;
  orders: { id: string; date: string; productSummary: string; amount: number; status: string }[];
  quotes: { id: string; date: string; type: string; itemCount: number; status: string }[];
}

/** Admin 화면에서만 쓰는 마스킹 완료 탈퇴 예시입니다. 실제 회원 API를 사용하지 않습니다. */
export const ADMIN_WITHDRAWN_MEMBER_FIXTURES: AdminWithdrawnMemberFixture[] = [
  {
    id: 'admin-demo-withdrawn-001',
    memberNumber: 'M-DEMO-0001',
    name: '홍*동',
    email: 'ex*****@email.com',
    phone: '010-****-0001',
    memberType: '개인',
    withdrawalType: '본인 탈퇴',
    reason: '탈퇴 사유 미제공',
    withdrawnAt: '2026-10-14T09:00:00+09:00',
    retentionUntil: '2031-10-14',
    processedBy: '본인',
    businessName: '—',
    detailedMemo: '합성 데모 기록입니다. 실제 회원 메모가 아닙니다.',
    orders: [
      {
        id: 'O-DEMO-0001',
        date: '2026-09-02',
        productSummary: '안전모 외 1건',
        amount: 42000,
        status: '배송완료',
      },
      {
        id: 'O-DEMO-0002',
        date: '2026-08-10',
        productSummary: '안전화 1건',
        amount: 68000,
        status: '배송완료',
      },
    ],
    quotes: [
      {
        id: 'Q-DEMO-0001',
        date: '2026-08-04',
        type: '맞춤 제작',
        itemCount: 2,
        status: '견적 발송',
      },
    ],
  },
  {
    id: 'admin-demo-withdrawn-002',
    memberNumber: 'M-DEMO-0002',
    name: '김*수',
    email: 'ab*****@email.com',
    phone: '010-****-0002',
    memberType: '사업자',
    withdrawalType: '강제 탈퇴',
    reason: '운영 정책 위반 · 데모 예시',
    withdrawnAt: '2026-10-12T14:30:00+09:00',
    retentionUntil: '2031-10-12',
    processedBy: '데모 관리자',
    businessName: '회*명',
    detailedMemo: '합성 데모 기록입니다. 실제 회원 메모가 아닙니다.',
    orders: [
      {
        id: 'O-DEMO-0003',
        date: '2026-09-21',
        productSummary: '작업복 외 1건',
        amount: 156000,
        status: '배송중',
      },
    ],
    quotes: [
      { id: 'Q-DEMO-0002', date: '2026-09-11', type: '대량 구매', itemCount: 4, status: '완료' },
      { id: 'Q-DEMO-0003', date: '2026-08-12', type: '맞춤 제작', itemCount: 1, status: '상담중' },
    ],
  },
];

export type AdminCouponStatus = 'active' | 'scheduled' | 'paused' | 'ended';
export type AdminCouponBenefitType = 'rate' | 'amount';

/** API의 개인 보유 Coupon과 분리된 운영용 쿠폰 목록 데모 모델입니다. */
export interface AdminCouponPreview {
  id: string;
  name: string;
  code: string;
  benefitType: AdminCouponBenefitType;
  benefitValue: number;
  maxDiscountAmount: number;
  minimumOrderAmount: number;
  target: 'all' | 'business' | 'personal';
  issueMethod: 'automatic' | 'download' | 'code';
  productScope: 'all' | 'category' | 'products';
  issueLimit: number | null;
  allowStacking: boolean;
  validityMode: 'period' | 'issueDays';
  validityDays: number | null;
  startsAt: string;
  endsAt: string;
  issuedCount: number;
  usedCount: number;
  status: AdminCouponStatus;
}

/** 목록 화면에서만 사용하는 합성 쿠폰 예시입니다. 전역/API 상태에 반영하지 않습니다. */
export const ADMIN_COUPON_PREVIEW_FIXTURES: AdminCouponPreview[] = [
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
  },
];
