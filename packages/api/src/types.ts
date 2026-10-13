/**
 * 쇼핑몰 도메인 타입.
 * 실제 API 스펙이 확정되면 이 파일을 기준으로 맞춥니다. 화면 코드는 이 타입만 의존합니다.
 * 금액 단위는 모두 원(KRW, 정수)이고, 날짜는 ISO 8601 문자열입니다.
 */

/** 재고 상태 */
export type StockStatus = 'inStock' | 'soldOut';

/** 상품 카테고리 */
export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
}

/** 상품 */
export interface Product {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  /** 판매가. 금액 표시 여부와 별개로 항상 값이 있습니다(₩0 가능). */
  price: number;
  /** 할인 전 정가. 할인이 없으면 null */
  listPrice: number | null;
  /**
   * 관리자의 "금액 표시 / 금액 미표시" 토글. price 값과 독립입니다.
   * false이면 가격 자리에 "구매 불가"를 보여 주고 바로 구매를 막습니다(장바구니 담기·찜은 가능).
   */
  priceVisible: boolean;
  stockStatus: StockStatus;
  /** 대표 이미지 URL. 아직 이미지가 없으면 null(플레이스홀더 표시) */
  thumbnailUrl: string | null;
  summary: string;
}

/** 장바구니 항목 */
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  /** 담을 당시의 상품 정보(표시용) */
  product: Product;
}

/** 배송지 */
export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2: string;
  isDefault: boolean;
}

/** 주문 상태 */
export type OrderStatus =
  'paymentPending' | 'paid' | 'preparing' | 'shipping' | 'delivered' | 'canceled';

/** 주문 상품 한 줄 */
export interface OrderLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

/** 주문 */
export interface Order {
  id: string;
  orderNumber: string;
  orderedAt: string;
  status: OrderStatus;
  memberId: string;
  lines: OrderLine[];
  productTotal: number;
  shippingFee: number;
  discountTotal: number;
  pointUsed: number;
  paymentTotal: number;
  shippingAddress: Address;
}

/** 취소·반품·교환 유형 */
export type ClaimType = 'cancel' | 'return' | 'exchange';

/** 취소·반품·교환 처리 상태 */
export type ClaimStatus = 'requested' | 'processing' | 'completed' | 'rejected';

/** 취소·반품·교환 신청 */
export interface Claim {
  id: string;
  orderId: string;
  type: ClaimType;
  status: ClaimStatus;
  reason: string;
  requestedAt: string;
}

/** 쿠폰 */
export interface Coupon {
  id: string;
  name: string;
  discountType: 'amount' | 'rate';
  /** amount이면 원, rate이면 % */
  discountValue: number;
  minOrderAmount: number;
  expiresAt: string;
  isUsed: boolean;
}

/** 적립금 내역 한 줄 */
export interface Point {
  id: string;
  description: string;
  /** 적립은 양수, 사용·소멸은 음수 */
  amount: number;
  occurredAt: string;
  expiresAt: string | null;
}

/** 견적 문의 상태: 접수 / 상담중 / 견적 발송 / 완료 / 취소 */
export type QuoteStatus = 'received' | 'consulting' | 'quoteSent' | 'completed' | 'canceled';

/** 견적 문의 */
export interface Quote {
  id: string;
  title: string;
  companyName: string;
  contactName: string;
  status: QuoteStatus;
  requestedAt: string;
  memberId: string | null;
}

/** 일반 회원 */
export interface Member {
  id: string;
  email: string;
  name: string;
  phone: string;
  joinedAt: string;
  pointBalance: number;
}

/** 관리자 권한 */
export type AdminRole = 'owner' | 'manager';

/** 관리자 계정(일반 회원과 분리) */
export interface AdminUser {
  id: string;
  loginId: string;
  name: string;
  role: AdminRole;
}

/** 공지사항 */
export interface Notice {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: string;
}

/** 자주 묻는 질문 */
export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
}

/** 1:1 문의 상태 */
export type InquiryStatus = 'waiting' | 'answered';

/** 1:1 문의 */
export interface Inquiry {
  id: string;
  memberId: string;
  title: string;
  body: string;
  status: InquiryStatus;
  createdAt: string;
  answer: string | null;
}

/** 목록 조회 응답(페이지네이션) */
export interface PagedResult<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}
