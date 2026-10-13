import type { ApiConfig } from './config';
import { ApiError } from './errors';
import type { ShopApi } from './shop-api';

// 아직 연결되지 않은 엔드포인트를 호출하면 바로 실패시키는 함수
function notImplemented(endpointName: string): () => Promise<never> {
  return () =>
    Promise.reject(
      new ApiError('NOT_IMPLEMENTED', `실제 API(${endpointName})는 아직 연결되지 않았습니다.`),
    );
}

/**
 * 실제 서버용 ShopApi 스텁.
 * API 스펙이 확정되면 config.baseUrl로 fetch하도록 엔드포인트별로 채웁니다.
 */
export function createRealApi(_config: ApiConfig): ShopApi {
  return {
    products: {
      list: notImplemented('products.list'),
      getById: notImplemented('products.getById'),
      suggest: notImplemented('products.suggest'),
      facets: notImplemented('products.facets'),
      listReviews: notImplemented('products.listReviews'),
    },
    search: { recommendedKeywords: notImplemented('search.recommendedKeywords') },
    categories: { list: notImplemented('categories.list') },
    home: { getContent: notImplemented('home.getContent') },
    company: { getInfo: notImplemented('company.getInfo') },
    orders: {
      listByMember: notImplemented('orders.listByMember'),
      getById: notImplemented('orders.getById'),
    },
    claims: { listByMember: notImplemented('claims.listByMember') },
    coupons: { list: notImplemented('coupons.list') },
    points: { list: notImplemented('points.list') },
    addresses: { list: notImplemented('addresses.list') },
    quotes: { list: notImplemented('quotes.list') },
    notices: { list: notImplemented('notices.list') },
    faqs: { list: notImplemented('faqs.list') },
    inquiries: { listByMember: notImplemented('inquiries.listByMember') },
    members: { list: notImplemented('members.list') },
  };
}
