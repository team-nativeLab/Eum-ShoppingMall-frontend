import type {
  Address,
  Brand,
  BrandSummary,
  Category,
  Claim,
  CompanyInfo,
  Coupon,
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
  ProductSuggestion,
  Quote,
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
    /** 상품 리뷰(최신순) */
    listReviews(
      productId: string,
      params?: PageParams,
      options?: RequestOptions,
    ): Promise<PagedResult<ProductReview>>;
  };
  /** 구매자에게 노출하는 브랜드. 비노출 브랜드는 목록에서 빠지고 상세는 NOT_FOUND입니다. */
  brands: {
    /** W-32 디렉터리용 전체 목록(정렬은 화면이 색인 규칙으로 합니다) */
    list(options?: RequestOptions): Promise<BrandSummary[]>;
    getById(brandId: string, options?: RequestOptions): Promise<Brand>;
    /** W-32 "이달의 브랜드". 지정한 브랜드가 없으면 null */
    getFeatured(options?: RequestOptions): Promise<Brand | null>;
  };
  /** 검색 결과가 없을 때 보여 줄 추천 검색어 */
  search: { recommendedKeywords(options?: RequestOptions): Promise<string[]> };
  /** 주문서의 mock 배송·결제 선택지. real API 미연결 상태에서는 NOT_IMPLEMENTED입니다. */
  checkout: { getOptions(options?: RequestOptions): Promise<CheckoutOptions> };
  categories: { list(options?: RequestOptions): Promise<Category[]> };
  home: { getContent(options?: RequestOptions): Promise<HomeContent> };
  /** 푸터 사업자·고객센터 정보 */
  company: { getInfo(options?: RequestOptions): Promise<CompanyInfo> };
  orders: {
    listByMember(memberId: string, options?: RequestOptions): Promise<Order[]>;
    getById(orderId: string, options?: RequestOptions): Promise<Order>;
    create(input: CreateOrderInput, options?: RequestOptions): Promise<OrderReceipt>;
  };
  claims: { listByMember(memberId: string, options?: RequestOptions): Promise<Claim[]> };
  coupons: { list(options?: RequestOptions): Promise<Coupon[]> };
  points: { list(options?: RequestOptions): Promise<Point[]> };
  addresses: { list(options?: RequestOptions): Promise<Address[]> };
  quotes: { list(options?: RequestOptions): Promise<Quote[]> };
  notices: { list(options?: RequestOptions): Promise<Notice[]> };
  faqs: { list(options?: RequestOptions): Promise<Faq[]> };
  inquiries: { listByMember(memberId: string, options?: RequestOptions): Promise<Inquiry[]> };
  members: { list(options?: RequestOptions): Promise<Member[]> };
}
