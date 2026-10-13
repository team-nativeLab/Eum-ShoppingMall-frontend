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
  /** 홈 카테고리 바에 이름 아래 보여 줄 짧은 소개. 없으면 null */
  description: string | null;
  /**
   * 홈 카테고리 바 아이콘 키(예: "hard-hat"). 화면이 아는 키가 아니거나 null이면 기본 아이콘을 씁니다.
   * 서버가 아이콘 이미지 URL을 주게 되면 이 필드를 대체합니다.
   */
  iconKey: string | null;
}

/** 상품 */
export interface Product {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  /** 구매자 응답 가격. 금액 비공개 상품은 실제 금액 대신 null을 받습니다. */
  price: number | null;
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
  /** 모델명. 등록하지 않았으면 null */
  modelName: string | null;
  /** 상세 갤러리. 서버 이미지가 아직 없으면 빈 배열입니다. */
  images: ProductImage[];
  /** 필수 여부를 포함한 구매 옵션 */
  options: ProductOption[];
  /** 상품에 노출할 사양 */
  specifications: ProductSpecification[];
  /** 상품 인증 표시명 */
  certifications: string[];
  /** 배송 및 반품 안내 */
  shipping: ProductShipping;
  /** 구매 전 안내(출고·증빙·교환·반품 등). 운영에서 정한 항목을 순서대로 보여 줍니다. */
  purchaseNotices: ProductPurchaseNotice[];
  /** 상품 평점. 리뷰가 없으면 null */
  rating: number | null;
  reviewCount: number;
  /** 최근 등록 상품 정렬에 쓰는 ISO 날짜 */
  createdAt: string;
  /** 홈 베스트 상품에 포함할지 여부 */
  isFeatured: boolean;
}

/** 구매자 응답과 별도로 실제 가격을 보관하는 Admin 편집 모델 */
export interface AdminProduct extends Omit<Product, 'price'> {
  price: number;
}

/** 상품 상세 이미지 */
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
}

/** 상품 옵션 선택지 */
export interface ProductOptionChoice {
  id: string;
  label: string;
  priceDelta: number;
}

/** 상품 구매 옵션 */
export interface ProductOption {
  id: string;
  label: string;
  required: boolean;
  choices: ProductOptionChoice[];
}

/** 상세 화면 사양 표의 한 행 */
export interface ProductSpecification {
  label: string;
  value: string;
}

/** 상품 배송 정보 */
export interface ProductShipping {
  method: string;
  estimate: string;
  fee: number;
  countryOfOrigin: string;
  /** 상세 "배송/교환/반품 안내" 본문 */
  policy: string;
}

/** 상세 구매 영역의 안내 한 줄(예: 출고 / 평일 오후 2시 이전 결제 시 당일 출고) */
export interface ProductPurchaseNotice {
  label: string;
  description: string;
}

/** 상품 리뷰 */
export interface ProductReview {
  id: string;
  productId: string;
  /** 화면에 그대로 보여 주는 작성자 표시명(서버가 마스킹해서 내려줌) */
  authorName: string;
  /** 1~5 정수 평점 */
  rating: number;
  content: string;
  /** 구매한 옵션 문구. 옵션 없는 상품이면 null */
  optionLabel: string | null;
  createdAt: string;
}

/** 목록 필터의 값별 상품 수 */
export interface FacetCount {
  /** 필터 값(브랜드명, 인증명, 카테고리 ID) */
  value: string;
  count: number;
}

/**
 * 목록·검색 결과의 필터 개수 묶음. 필드마다 세는 범위가 다르므로 화면은 필드 설명대로만 씁니다.
 * - 브랜드·인증·가격 선택은 어느 개수에도 반영하지 않습니다(선택 전 범위의 개수).
 */
export interface ProductFacets {
  /** 요청한 카테고리(하위 포함)와 검색어 범위의 상품 수 */
  totalCount: number;
  /**
   * 카테고리 선택과 무관하게 검색어 범위 전체에서 센 상품 수.
   * 검색 결과 없음 판정과 검색 카테고리 칩 "전체 N"에 씁니다. 검색어가 없으면 전체 상품 수입니다.
   */
  keywordTotalCount: number;
  /**
   * 상위 카테고리별 상품 수. 요청한 categoryId와 무관하게 검색어 범위 전체에서 세며,
   * 결과가 있는 상위 카테고리만 담습니다. 합계가 keywordTotalCount와 같다고 가정하지 않습니다.
   */
  categories: FacetCount[];
  /** 요청한 카테고리·검색어 범위의 브랜드별 상품 수 */
  brands: FacetCount[];
  /** 요청한 카테고리·검색어 범위의 인증별 상품 수(상품 하나가 여러 인증에 들어갈 수 있음) */
  certifications: FacetCount[];
}

/** 홈/검색 자동완성 상품 추천 */
export interface ProductSuggestion {
  productId: string;
  name: string;
  brand: string;
}

/** 홈 히어로 슬라이드 */
export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string[];
  /** 부제. 줄바꿈(\n)으로 줄을 나눕니다. 모바일에서는 첫 줄만 보여 줍니다. */
  description: string;
  /** 데스크톱 히어로 오른쪽 위 세로 문구(줄 단위). 없으면 빈 배열 */
  tagline: string[];
  imageUrl: string;
  destination: string;
  /** 주 버튼 문구(destination으로 이동) */
  ctaLabel: string;
  /** 데스크톱에서만 보여 주는 보조 링크. 없으면 그리지 않습니다. */
  secondaryCta?: HomeLink;
}

/** 홈 콘텐츠의 문구 + 이동 경로 묶음 */
export interface HomeLink {
  label: string;
  destination: string;
}

/** 홈 하단 견적 문의 띠(HF/Web/CTABand) */
export interface HomeCtaBand {
  eyebrow: string;
  title: string;
  cta: HomeLink;
}

/** 홈 프로모션 배너 */
export interface PromoBanner {
  id: string;
  title: string[];
  description: string;
  imageUrl: string;
  tone: 'dark' | 'light';
  destination: string;
}

/** 홈 배송/서비스 안내 */
export interface ServiceBenefit {
  id: string;
  title: string;
  description: string;
}

/** 홈 화면 조회 결과 */
export interface HomeContent {
  heroSlides: HeroSlide[];
  promoBanners: PromoBanner[];
  serviceBenefits: ServiceBenefit[];
  featuredProducts: Product[];
  /** 하단 견적 문의 띠. 운영에서 끄면 null */
  ctaBand: HomeCtaBand | null;
}

/** 푸터에 표시하는 사업자·고객센터 정보 */
export interface CompanyInfo {
  /** 상호 */
  companyName: string;
  /** 대표자 */
  representative: string;
  businessRegistrationNumber: string;
  /** 통신판매업 신고번호 */
  mailOrderSalesNumber: string;
  address: string;
  email: string;
  /** 개인정보보호책임자 */
  privacyOfficer: string;
  /** 화면에 그대로 보여 주는 고객센터 번호(내선 안내 등 포함 가능) */
  customerCenterPhone: string;
  /** 전화 걸기(tel:) 링크용 번호. 숫자와 +만 씁니다. 없으면 표시 문자열에서 추출합니다. */
  customerCenterTel: string | null;
  /** 고객센터 운영 시간 안내 문구 */
  customerCenterHours: string;
}

/** 장바구니 항목 */
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  /** 동일 상품의 옵션별 줄을 구분합니다. */
  optionId: string | null;
  optionLabel: string | null;
  /** 화면 표시를 위해 API에서 다시 조회한 최신 상품 정보 */
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
