import type {
  Address,
  AdminProduct,
  AdminBrand,
  AdminHomeContentInput,
  AdminShopEvent,
  AdminOrder,
  AdminClaim,
  AdminQuote,
  Brand,
  BrandSummary,
  Category,
  Claim,
  ClaimSubmitInput,
  CompanyInfo,
  Coupon,
  CouponOffer,
  AdminCoupon,
  AdminFaq,
  AdminNotice,
  AdminInquiry,
  AdminProductReview,
  AdminProductQuestion,
  AdminLegalDocument,
  LegalDocumentId,
  AdminPoint,
  AdminShopSettings,
  CheckoutOptions,
  CreateOrderInput,
  Faq,
  HomeContent,
  Inquiry,
  Member,
  Notice,
  Order,
  OrderReceipt,
  PagedResult,
  Point,
  Product,
  ProductFacets,
  ProductReview,
  ProductQuestion,
  ProductReviewSummary,
  ProductSuggestion,
  Quote,
  ShopEvent,
} from './types';

/** 상품 목록 조회 조건 */
export interface ProductListParams {
  categoryId?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string[];
  certification?: string[];
  excludeSoldOut?: boolean;
  sortBy?: 'recommended' | 'priceAsc' | 'priceDesc' | 'newest' | 'ratingDesc';
  page?: number;
  pageSize?: number;
}

/** 필터 개수 조회 조건. 개수는 브랜드·인증·가격 선택과 무관하게 카테고리·검색어 범위에서 셉니다. */
export type ProductFacetParams = Pick<ProductListParams, 'categoryId' | 'keyword'>;

/** 개수만 정하는 목록 조회 조건(관련·추천 상품) */
export interface ProductLimitParams {
  /** 최대 개수. 없으면 서버 기본값 */
  limit?: number;
}

/** 페이지 조회 조건 */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** 모든 조회에 공통으로 넘길 수 있는 옵션 */
export interface RequestOptions {
  /** 화면을 떠나거나 쿼리가 취소되면 요청을 멈춥니다(TanStack Query의 signal을 그대로 넘김). */
  signal?: AbortSignal;
}

export type AdminProductInput = Omit<
  AdminProduct,
  'id' | 'createdAt' | 'rating' | 'reviewCount'
> & {
  id?: string;
};
export type AdminBrandInput = Omit<AdminBrand, 'id' | 'productCount'> & { id?: string };
export type AdminShopEventInput = Omit<AdminShopEvent, 'id'> & { id?: string };
export type AdminOrderUpdate = Partial<
  Pick<AdminOrder, 'status' | 'trackingCarrier' | 'trackingNumber' | 'adminMemo'>
>;
export type AdminClaimUpdate = Partial<Pick<AdminClaim, 'status' | 'adminMemo'>>;
export type AdminQuoteUpdate = Partial<
  Pick<
    AdminQuote,
    'status' | 'internalMemo' | 'publicMessage' | 'quoteAmount' | 'expiresAt' | 'attachments'
  >
>;
export type QuoteSubmitInput = Pick<
  AdminQuote,
  'title' | 'companyName' | 'contactName' | 'inquiryBody' | 'requestedItems' | 'attachments'
>;
export type AdminCouponInput = Omit<AdminCoupon, 'id' | 'issuedCount' | 'usedCount'> & {
  id?: string;
};
export type AdminNoticeInput = Omit<AdminNotice, 'id'> & { id?: string };
export type AdminFaqInput = Omit<AdminFaq, 'id'> & { id?: string };
export type AdminInquiryUpdate = Partial<Pick<AdminInquiry, 'status' | 'answer' | 'adminMemo'>>;
export type AdminProductReviewUpdate = Partial<
  Pick<AdminProductReview, 'isVisible' | 'adminReply' | 'adminMemo'>
>;
export type AdminProductQuestionUpdate = Partial<
  Pick<AdminProductQuestion, 'status' | 'answer' | 'adminMemo'>
>;

/**
 * 화면이 쓰는 조회 함수 묶음. mock(mock-api.ts)과 real(real-api.ts)이 같은 모양을 구현합니다.
 * 어느 구현을 쓸지는 각 앱의 src/lib/shop-api.ts가 빌드 상수(API_MODE)로 정해서,
 * real 빌드에서는 목 구현과 목 데이터가 번들에서 빠지게 합니다.
 */
export interface ShopApi {
  products: {
    list(params?: ProductListParams, options?: RequestOptions): Promise<PagedResult<Product>>;
    getById(productId: string, options?: RequestOptions): Promise<Product>;
    suggest(keyword: string, options?: RequestOptions): Promise<ProductSuggestion[]>;
    /** 목록 필터에 표시할 카테고리·브랜드·인증별 상품 수 */
    facets(params?: ProductFacetParams, options?: RequestOptions): Promise<ProductFacets>;
    /** 상세 화면 "함께 구매하면 좋은 제품". 기준 상품은 결과에서 빠지며, 고르는 규칙은 서버가 정합니다. */
    listRelated(
      productId: string,
      params?: ProductLimitParams,
      options?: RequestOptions,
    ): Promise<Product[]>;
    /** 검색 결과 없음 화면의 "추천 상품". 고르는 규칙은 서버가 정합니다. */
    listRecommended(params?: ProductLimitParams, options?: RequestOptions): Promise<Product[]>;
    /** 관리자용 전체 상품과 판매가·재고 편집 모델 */
    adminList(options?: RequestOptions): Promise<AdminProduct[]>;
    saveAdmin(input: AdminProductInput, options?: RequestOptions): Promise<AdminProduct>;
    deleteAdmin(productId: string, options?: RequestOptions): Promise<void>;
    /** 상품 리뷰(최신순) */
    listReviews(
      productId: string,
      params?: PageParams,
      options?: RequestOptions,
    ): Promise<PagedResult<ProductReview>>;
    /** 전체 리뷰 화면의 평점·사진 리뷰 요약 */
    getReviewSummary(productId: string, options?: RequestOptions): Promise<ProductReviewSummary>;
    adminListReviews(options?: RequestOptions): Promise<AdminProductReview[]>;
    updateReviewAdmin(
      reviewId: string,
      update: AdminProductReviewUpdate,
      options?: RequestOptions,
    ): Promise<AdminProductReview>;
    listQuestions(productId: string, options?: RequestOptions): Promise<ProductQuestion[]>;
    adminListQuestions(options?: RequestOptions): Promise<AdminProductQuestion[]>;
    updateQuestionAdmin(
      questionId: string,
      update: AdminProductQuestionUpdate,
      options?: RequestOptions,
    ): Promise<AdminProductQuestion>;
  };
  /** 구매자에게 노출하는 브랜드. 비노출 브랜드는 목록에서 빠지고 상세는 NOT_FOUND입니다. */
  brands: {
    /** W-32 디렉터리용 전체 목록(정렬은 화면이 색인 규칙으로 합니다) */
    list(options?: RequestOptions): Promise<BrandSummary[]>;
    getById(brandId: string, options?: RequestOptions): Promise<Brand>;
    /** W-32 "이달의 브랜드". 지정한 브랜드가 없으면 null */
    getFeatured(options?: RequestOptions): Promise<Brand | null>;
    adminList(options?: RequestOptions): Promise<AdminBrand[]>;
    saveAdmin(input: AdminBrandInput, options?: RequestOptions): Promise<AdminBrand>;
    deleteAdmin(brandId: string, options?: RequestOptions): Promise<void>;
  };
  /** 검색 결과가 없을 때 보여 줄 추천 검색어 */
  search: { recommendedKeywords(options?: RequestOptions): Promise<string[]> };
  /** 주문서의 mock 배송·결제 선택지. real API 미연결 상태에서는 NOT_IMPLEMENTED입니다. */
  checkout: { getOptions(options?: RequestOptions): Promise<CheckoutOptions> };
  categories: {
    list(options?: RequestOptions): Promise<Category[]>;
    adminList(options?: RequestOptions): Promise<Category[]>;
    save(
      input: Omit<Category, 'id'> & { id?: string },
      options?: RequestOptions,
    ): Promise<Category>;
    delete(categoryId: string, options?: RequestOptions): Promise<void>;
  };
  home: {
    getContent(options?: RequestOptions): Promise<HomeContent>;
    getAdminContent(options?: RequestOptions): Promise<AdminHomeContentInput>;
    saveAdminContent(
      input: AdminHomeContentInput,
      options?: RequestOptions,
    ): Promise<AdminHomeContentInput>;
  };
  /** 푸터 사업자·고객센터 정보 */
  company: {
    getInfo(options?: RequestOptions): Promise<CompanyInfo>;
    getAdminInfo(options?: RequestOptions): Promise<CompanyInfo>;
    saveAdminInfo(input: CompanyInfo, options?: RequestOptions): Promise<CompanyInfo>;
  };
  legalDocuments: {
    getPublished(
      documentId: LegalDocumentId,
      options?: RequestOptions,
    ): Promise<AdminLegalDocument>;
    adminList(options?: RequestOptions): Promise<AdminLegalDocument[]>;
    saveAdmin(input: AdminLegalDocument, options?: RequestOptions): Promise<AdminLegalDocument>;
  };
  orders: {
    adminList(options?: RequestOptions): Promise<AdminOrder[]>;
    adminGetById(orderId: string, options?: RequestOptions): Promise<AdminOrder>;
    updateAdmin(
      orderId: string,
      update: AdminOrderUpdate,
      options?: RequestOptions,
    ): Promise<AdminOrder>;
    listByMember(memberId: string, options?: RequestOptions): Promise<Order[]>;
    getById(orderId: string, options?: RequestOptions): Promise<Order>;
    create(input: CreateOrderInput, options?: RequestOptions): Promise<OrderReceipt>;
  };
  claims: {
    adminList(options?: RequestOptions): Promise<AdminClaim[]>;
    updateAdmin(
      claimId: string,
      update: AdminClaimUpdate,
      options?: RequestOptions,
    ): Promise<AdminClaim>;
    submit(input: ClaimSubmitInput, options?: RequestOptions): Promise<Claim>;
    /** 취소 요청과 주문 상태를 단일 mock mutation으로 처리합니다. */
    completeOrderCancellation(
      orderId: string,
      claimId: string,
      reason: string,
      options?: RequestOptions,
    ): Promise<{ order: AdminOrder; claim: AdminClaim }>;
    listByMember(memberId: string, options?: RequestOptions): Promise<Claim[]>;
  };
  coupons: {
    /** Coupons currently eligible for checkout. */
    list(options?: RequestOptions): Promise<Coupon[]>;
    historyList(options?: RequestOptions): Promise<Coupon[]>;
    availableList(options?: RequestOptions): Promise<CouponOffer[]>;
    acquire(couponId: string, options?: RequestOptions): Promise<Coupon>;
    redeemCode(code: string, options?: RequestOptions): Promise<Coupon>;
    adminList(options?: RequestOptions): Promise<AdminCoupon[]>;
    saveAdmin(input: AdminCouponInput, options?: RequestOptions): Promise<AdminCoupon>;
    deleteAdmin(couponId: string, options?: RequestOptions): Promise<void>;
  };
  settings: {
    getAdmin(options?: RequestOptions): Promise<AdminShopSettings>;
    saveAdmin(input: AdminShopSettings, options?: RequestOptions): Promise<AdminShopSettings>;
  };
  points: {
    list(options?: RequestOptions): Promise<Point[]>;
    adminList(options?: RequestOptions): Promise<AdminPoint[]>;
    adjustAdmin(
      input: { memberId: string; amount: number; reason: string; expiresAt: string | null },
      options?: RequestOptions,
    ): Promise<AdminPoint>;
  };
  addresses: { list(options?: RequestOptions): Promise<Address[]> };
  quotes: {
    submit(input: QuoteSubmitInput, options?: RequestOptions): Promise<Quote>;
    adminList(options?: RequestOptions): Promise<AdminQuote[]>;
    updateAdmin(
      quoteId: string,
      update: AdminQuoteUpdate,
      options?: RequestOptions,
    ): Promise<AdminQuote>;
    listByMember(memberId: string, options?: RequestOptions): Promise<Quote[]>;
  };
  notices: {
    list(options?: RequestOptions): Promise<Notice[]>;
    adminList(options?: RequestOptions): Promise<AdminNotice[]>;
    saveAdmin(input: AdminNoticeInput, options?: RequestOptions): Promise<AdminNotice>;
    deleteAdmin(noticeId: string, options?: RequestOptions): Promise<void>;
  };
  events: {
    list(options?: RequestOptions): Promise<ShopEvent[]>;
    getById(eventId: string, options?: RequestOptions): Promise<ShopEvent>;
    adminList(options?: RequestOptions): Promise<AdminShopEvent[]>;
    saveAdmin(input: AdminShopEventInput, options?: RequestOptions): Promise<AdminShopEvent>;
    deleteAdmin(eventId: string, options?: RequestOptions): Promise<void>;
  };
  faqs: {
    list(options?: RequestOptions): Promise<Faq[]>;
    adminList(options?: RequestOptions): Promise<AdminFaq[]>;
    saveAdmin(input: AdminFaqInput, options?: RequestOptions): Promise<AdminFaq>;
    deleteAdmin(faqId: string, options?: RequestOptions): Promise<void>;
  };
  inquiries: {
    listByMember(memberId: string, options?: RequestOptions): Promise<Inquiry[]>;
    adminList(options?: RequestOptions): Promise<AdminInquiry[]>;
    updateAdmin(
      inquiryId: string,
      update: AdminInquiryUpdate,
      options?: RequestOptions,
    ): Promise<AdminInquiry>;
  };
  members: {
    /** Returns only the current buyer session member. The mock does not implement real authentication. */
    getCurrent(options?: RequestOptions): Promise<Member>;
    /** Buyer-safe single-member list; never enumerates other member records. */
    list(options?: RequestOptions): Promise<Member[]>;
    /** Admin-only member directory contract; the mock has no server-side authorization. */
    adminList(options?: RequestOptions): Promise<Member[]>;
  };
}
