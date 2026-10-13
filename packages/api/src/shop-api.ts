import type {
  Address,
  Category,
  Claim,
  Coupon,
  Faq,
  Inquiry,
  Member,
  Notice,
  Order,
  PagedResult,
  Point,
  Product,
  Quote,
} from './types';

/** 상품 목록 조회 조건 */
export interface ProductListParams {
  categoryId?: string;
  keyword?: string;
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
  };
  categories: { list(options?: RequestOptions): Promise<Category[]> };
  orders: {
    listByMember(memberId: string, options?: RequestOptions): Promise<Order[]>;
    getById(orderId: string, options?: RequestOptions): Promise<Order>;
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
