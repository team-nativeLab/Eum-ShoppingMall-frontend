import type {
  PageParams,
  ProductFacetParams,
  ProductLimitParams,
  ProductListParams,
} from './shop-api';

/** TanStack Query 키 모음. web과 admin이 같은 키 규칙을 씁니다. */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (params: ProductListParams = {}) => ['products', 'list', params] as const,
    detail: (productId: string) => ['products', 'detail', productId] as const,
    suggestions: (keyword: string) => ['products', 'suggestions', keyword] as const,
    facets: (params: ProductFacetParams = {}) => ['products', 'facets', params] as const,
    reviews: (productId: string, params: PageParams = {}) =>
      ['products', 'reviews', productId, params] as const,
    reviewSummary: (productId: string) => ['products', 'review-summary', productId] as const,
    related: (productId: string, params: ProductLimitParams = {}) =>
      ['products', 'related', productId, params] as const,
    recommended: (params: ProductLimitParams = {}) => ['products', 'recommended', params] as const,
  },
  brands: {
    all: ['brands'] as const,
    list: ['brands', 'list'] as const,
    detail: (brandId: string) => ['brands', 'detail', brandId] as const,
    featured: ['brands', 'featured'] as const,
  },
  search: { recommendedKeywords: ['search', 'recommended-keywords'] as const },
  checkout: { options: ['checkout', 'options'] as const },
  addresses: {
    all: ['addresses'] as const,
    byMember: (memberId: string) => ['addresses', memberId] as const,
  },
  coupons: { all: ['coupons'] as const },
  categories: { all: ['categories'] as const },
  home: { content: ['home', 'content'] as const },
  company: { info: ['company', 'info'] as const },
  quotes: { all: ['quotes'] as const },
  notices: { all: ['notices'] as const },
  events: {
    all: ['events'] as const,
    detail: (eventId: string) => ['events', 'detail', eventId] as const,
  },
  faqs: { all: ['faqs'] as const },
  inquiries: {
    all: ['support', 'inquiries'] as const,
    byMember: (memberId: string) => ['support', 'inquiries', memberId] as const,
  },
  myPage: {
    all: ['mypage'] as const,
    byMember: (memberId: string) => ['mypage', memberId] as const,
  },
  members: { all: ['members'] as const },
  orders: {
    allByMember: ['orders', 'member'] as const,
    byMember: (memberId: string) => ['orders', 'member', memberId] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },
};
