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
  isVisible?: boolean;
  sortOrder?: number;
  filterAttributes?: { id: string; name: string; values: string[] }[];
}

/** 브랜드 목록 항목(W-32 디렉터리·전체 메뉴). 구매자에게 노출하는 브랜드만 내려옵니다. */
export interface BrandSummary {
  id: string;
  name: string;
  /** 영문 표기. 없으면 null */
  englishName: string | null;
  /** 로고 이미지 URL. 아직 없으면 null(플레이스홀더 표시) */
  logoUrl: string | null;
  /** 한 줄 소개(관리자 입력 텍스트). 없으면 null */
  tagline: string | null;
  /** 구매자에게 노출되는 이 브랜드 상품 수 */
  productCount: number;
}

/** 브랜드 상세(W-33). 관리자 입력 텍스트는 화면에서 텍스트 노드로만 그립니다. */
export interface Brand extends BrandSummary {
  /** 히어로 사진 URL. 없으면 null(로고 패널로 대체) */
  coverImageUrl: string | null;
  /** 주력 분야. 없으면 null */
  mainField: string | null;
  /** 원산지. 없으면 null */
  originCountry: string | null;
  /** 주요 인증 표시 문구. 없으면 null */
  certification: string | null;
  /** 브랜드 스토리. 등록하지 않았으면 null */
  story: { title: string; body: string } | null;
}

/** 관리자에서 편집하는 브랜드 운영 상태 */
export interface AdminBrand extends Brand {
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder?: number;
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
  /** 상세 본문 콘텐츠. 없으면 summary를 노출합니다. */
  detailDescription?: string;
  /** 상세 본문 서식. 이전 데이터처럼 없으면 평문으로 표시합니다. */
  detailDescriptionFormat?: 'plain' | 'rich-v1';
  /** 모델명. 등록하지 않았으면 null */
  modelName: string | null;
  /** 상세 갤러리. 서버 이미지가 아직 없으면 빈 배열입니다. */
  images: ProductImage[];
  /** 필수 여부를 포함한 구매 옵션 */
  options: ProductOption[];
  /** 옵션 조합별 추가금·재고·판매 상태. SKU 편집 행이 있는 경우에만 제공합니다. */
  skus?: ProductSku[];
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

/** 구매자에게 공개할 옵션 조합별 판매 정보 */
export interface ProductSku {
  id: string;
  optionLabels: string[];
  priceDelta: number;
  isAvailable: boolean;
  imageUrl: string | null;
}

/** 구매자 응답과 별도로 실제 가격을 보관하는 Admin 편집 모델 */
export interface AdminProduct extends Omit<Product, 'price' | 'skus'> {
  price: number;
  productCode?: string;
  stockCount?: number;
  /** SKU 재고가 모두 0이면 구매자 상품 상태도 품절로 표시합니다. */
  autoSoldOut?: boolean;
  salesStatus?: 'active' | 'paused' | 'ended';
  isVisible?: boolean;
  manufacturer?: string;
  material?: string;
  dimensions?: string;
  weight?: string;
  detailDescription?: string;
  skus?: AdminProductSku[];
}

/** 관리자가 옵션 조합별로 관리하는 SKU 재고 행 */
export interface AdminProductSku {
  id: string;
  optionLabels: string[];
  productCode: string;
  priceDelta: number;
  stockCount: number;
  salesStatus: 'active' | 'paused' | 'ended';
  imageId: string | null;
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
  /** 공개된 관리자 답변. 내부 메모는 포함하지 않습니다. */
  adminReply?: string;
}

export interface AdminProductReview extends ProductReview {
  isVisible: boolean;
  adminReply: string;
  adminMemo: string;
}

/** 상품 전체 리뷰 요약 */
export interface ProductReviewSummary {
  productId: string;
  averageRating: number | null;
  totalCount: number;
  /** 별점별 작성 건수. 키는 1~5입니다. */
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  photoReviewCount: number;
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

/** 관리자 홈 편성 저장 모델. 상품 상세는 ID로 연결해 Web 응답에서 최신 데이터를 구성합니다. */
export interface AdminHomeContentInput {
  heroSlides: HeroSlide[];
  promoBanners: PromoBanner[];
  serviceBenefits: ServiceBenefit[];
  featuredProductIds: string[];
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
  /** 견적 문의 담당 이메일. 제공하지 않으면 견적 화면에서 연락처를 생략합니다. */
  quoteEmail?: string;
  /** 개인정보보호책임자 */
  privacyOfficer: string;
  /** 화면에 그대로 보여 주는 고객센터 번호(내선 안내 등 포함 가능) */
  customerCenterPhone: string;
  /** 전화 걸기(tel:) 링크용 번호. 숫자와 +만 씁니다. 없으면 표시 문자열에서 추출합니다. */
  customerCenterTel: string | null;
  /** 고객센터 운영 시간 안내 문구 */
  customerCenterHours: string;
}

export type LegalDocumentId = 'terms' | 'privacy' | 'guide' | 'shipping';

/** 관리자에서 공개할 법률·운영 문서의 버전 모델입니다. 본문은 텍스트로만 렌더링합니다. */
export interface AdminLegalDocument {
  id: LegalDocumentId;
  title: string;
  version: string;
  effectiveAt: string;
  body: string;
  isPublished: boolean;
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

/** Internal mock address owner. `memberId` is removed from buyer responses. */
export interface AdminAddress extends Address {
  memberId: string;
}

/** 주문서에서 선택할 수 있는 mock 결제 수단. 실제 결제 연동은 포함하지 않습니다. */
export type PaymentMethod =
  'creditCard' | 'bankTransfer' | 'virtualAccount' | 'simpleA' | 'simpleB' | 'mobile';

/** 배송·결제 화면에 필요한 정책 선택지. 실제 API 연결 전까지 mock 응답만 제공합니다. */
export interface CheckoutOptions {
  freeShippingThreshold: number;
  shippingFee: number;
  freeShippingScope?: 'all' | 'cart';
  baseFeeMode?: 'customer' | 'included';
  deliveryRequests: { id: string; label: string }[];
  shippingMethods: { id: string; label: string; description: string }[];
  paymentMethods: { id: PaymentMethod; label: string }[];
}

/** 관리자 배송·할인 정책. 목 주문의 배송비 계산과 checkout 표시에서 사용합니다. */
export interface AdminShopSettings {
  baseShippingFee: number;
  baseFeeMode: 'customer' | 'included';
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  freeShippingScope: 'all' | 'cart';
  remoteFeeEnabled: boolean;
  jejuFee: number;
  islandFee: number;
  returnFee: number;
  exchangeFee: number;
  combineReturnShipping: boolean;
  businessDiscountEnabled: boolean;
  businessDiscountRate: number;
  businessDiscountScope: 'direct' | 'category';
  businessCouponStacking: boolean;
  firstPurchaseEnabled: boolean;
  firstPurchaseBenefitType: 'rate' | 'amount';
  firstPurchaseBenefitValue: number;
  firstPurchaseMaxDiscount: number;
  firstPurchaseMinimumOrder: number;
  firstPurchasePaymentScope: 'all' | 'newOnly';
}

/** 목 주문 생성 요청. real API에서는 서버가 상품·쿠폰·배송비·합계를 다시 계산해야 합니다. */
export interface CreateOrderInput {
  /** Same key and payload reuse the prior mock receipt without applying inventory or benefits twice. */
  idempotencyKey?: string;
  lines: { productId: string; quantity: number; optionId: string | null }[];
  shippingAddress: Address;
  deliveryRequest: string;
  paymentMethod: PaymentMethod;
  couponId: string | null;
  pointsToUse: number;
}

/** 목 주문 응답은 배송/결제 상세나 결제 자격 정보를 저장하지 않습니다. */
export interface OrderReceipt {
  orderNumber: string;
  productTotal: number;
  discountTotal: number;
  shippingFee: number;
  pointsUsed: number;
  paymentTotal: number;
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
  /** Mock checkout snapshot used by Admin and claim quantity validation. */
  optionId?: string | null;
  skuId?: string | null;
  optionLabel?: string | null;
}

/** 주문 */
export interface Order {
  id: string;
  orderNumber: string;
  orderedAt: string;
  status: OrderStatus;
  /** Internal mock ownership key. Buyer order projections omit this field. */
  memberId?: string;
  lines: OrderLine[];
  productTotal: number;
  shippingFee: number;
  discountTotal: number;
  pointUsed: number;
  paymentTotal: number;
  shippingAddress: Address;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
}

/** 관리자 주문 처리 데이터. 구매자 주문 응답에서는 이 필드를 제외합니다. */
export interface AdminOrder extends Order {
  memberId: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  adminMemo: string;
  statusHistory: { status: OrderStatus; occurredAt: string; note: string }[];
  /** Internal mock ownership key of a coupon consumed by this order. */
  usedCouponId?: string | null;
}

/** 취소·반품·교환 유형 */
export type ClaimType = 'cancel' | 'return' | 'exchange';

/** 취소·반품·교환 처리 상태 */
export type ClaimStatus = 'requested' | 'processing' | 'completed' | 'rejected';

export type ClaimReturnMethod = 'pickup' | 'direct';

export interface ClaimAttachmentMetadata {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type ClaimReturnAddress = Pick<
  Address,
  'recipientName' | 'phone' | 'postalCode' | 'address1' | 'address2'
>;

/** 취소·반품·교환 신청 */
export interface Claim {
  id: string;
  orderId: string;
  type: ClaimType;
  status: ClaimStatus;
  reason: string;
  description?: string;
  items?: {
    productId: string;
    quantity: number;
    skuId?: string | null;
    optionLabel?: string | null;
  }[];
  returnMethod?: ClaimReturnMethod;
  returnAddress?: ClaimReturnAddress;
  attachments?: ClaimAttachmentMetadata[];
  requestedAt: string;
}

/** 구매자 취소·반품·교환 신청. 주문 소유자는 mock API 세션에서 결정합니다. */
export interface ClaimSubmitInput {
  orderId: string;
  type: ClaimType;
  reason: string;
  description: string;
  items: { productId: string; quantity: number; skuId?: string | null }[];
  returnMethod?: ClaimReturnMethod;
  returnAddress?: ClaimReturnAddress;
  attachments?: ClaimAttachmentMetadata[];
}

export interface AdminClaim extends Claim {
  adminMemo: string;
  statusHistory: { status: ClaimStatus; occurredAt: string; note: string }[];
}

/** 쿠폰 */
export interface Coupon {
  id: string;
  name: string;
  discountType: 'amount' | 'rate';
  /** amount이면 원, rate이면 % */
  discountValue: number;
  /** 운영 카탈로그 할인 한도. 없으면 주문 금액까지만 할인합니다. */
  maxDiscountAmount?: number;
  minOrderAmount: number;
  expiresAt: string;
  isUsed: boolean;
  /** 회원에게 이미 발급된 쿠폰의 운영 카탈로그 ID */
  adminCouponId?: string;
}

/** 구매자가 획득할 수 있는 운영 쿠폰 제안. 실제 코드와 회원 식별자는 포함하지 않습니다. */
export interface CouponOffer {
  id: string;
  name: string;
  discountType: 'amount' | 'rate';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  expiresAt: string;
  issueMethod: 'automatic' | 'download' | 'code';
  isAcquired: boolean;
}

export type AdminCouponStatus = 'active' | 'scheduled' | 'paused' | 'ended';
export interface AdminCoupon {
  id: string;
  name: string;
  code: string;
  benefitType: 'rate' | 'amount';
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
  notice: string;
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

/** 운영에서 조정한 적립금 원장 행. 회원 식별자는 관리자 전용 응답에만 포함됩니다. */
export interface AdminPoint extends Point {
  memberId: string;
  reason: string;
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
  /** 본인 문의 상세에서만 공개하는 요청 내용 */
  inquiryBody?: string;
  requestedItems?: { name: string; quantity: number; option?: string }[];
  /** 첨부 파일 다운로드 데이터는 제외한 메타데이터 */
  attachments?: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
  /** 회원에게 공개할 견적 답변 정보 */
  publicMessage?: string | null;
  quoteAmount?: number | null;
  expiresAt?: string | null;
}

/** 관리자 견적 데이터. 내부 메모와 고객 공개 답변을 분리합니다. */
export interface AdminQuote extends Quote {
  inquiryBody: string;
  requestedItems: { name: string; quantity: number; option?: string }[];
  /** 목 API가 보관하는 첨부 메타데이터. 파일 바이트는 저장하지 않습니다. */
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
  internalMemo: string;
  publicMessage: string | null;
  quoteAmount: number | null;
  expiresAt: string | null;
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
  /** 조회수를 제공하는 API만 전달합니다. 값이 없으면 화면은 미제공으로 표시합니다. */
  viewCount?: number;
  /** Figma 상세 샘플의 본문 이미지 영역. 이미지가 아직 없으면 자리표시자를 표시합니다. */
  bodyImage?: { src: string | null; alt: string };
  /** Figma 상세 샘플의 첨부 행. URL이 없으면 파일 정보만 표시합니다. */
  attachments?: { id: string; fileName: string; sizeBytes: number; downloadUrl?: string }[];
}

export interface AdminNotice extends Notice {
  isVisible: boolean;
  sortOrder: number;
}

/** 구매자에게 노출하는 이벤트·기획전 */
export type ShopEventStatus = 'ongoing' | 'upcoming' | 'ended';

export interface ShopEvent {
  id: string;
  title: string;
  subtitle: string;
  status: ShopEventStatus;
  startAt: string;
  endAt: string;
  eyebrow: string;
  heroTitle: string[];
  heroDescription: string;
  body: string;
  sections: { heading: string; body: string }[];
  searchKeyword: string;
}

/** 관리자 이벤트 목록·편집 모델 */
export interface AdminShopEvent extends ShopEvent {
  isVisible: boolean;
  sortOrder: number;
}

/** 자주 묻는 질문 */
export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface AdminFaq extends Faq {
  isVisible: boolean;
  sortOrder: number;
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
  attachments?: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl?: string;
  }[];
}

export interface AdminInquiry extends Inquiry {
  adminMemo: string;
  statusHistory: { status: InquiryStatus; occurredAt: string; note: string }[];
}

export type ProductQuestionStatus = 'waiting' | 'answered';

/** 상품 상세에 표시하는 구매자 상품 문의입니다. 작성자 표시는 마스킹된 이름만 포함합니다. */
export interface ProductQuestion {
  id: string;
  productId: string;
  authorName: string;
  title: string;
  body: string;
  isPrivate: boolean;
  status: ProductQuestionStatus;
  createdAt: string;
  answer: string | null;
}

/** 관리자 답변·메모·처리 이력을 포함하는 상품 문의 모델입니다. */
export interface AdminProductQuestion extends ProductQuestion {
  adminMemo: string;
  statusHistory: { status: ProductQuestionStatus; occurredAt: string; note: string }[];
}

/** 목록 조회 응답(페이지네이션) */
export interface PagedResult<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}
