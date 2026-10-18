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
      getReviewSummary: notImplemented('products.getReviewSummary'),
      adminListReviews: notImplemented('products.adminListReviews'),
      updateReviewAdmin: notImplemented('products.updateReviewAdmin'),
      listQuestions: notImplemented('products.listQuestions'),
      adminListQuestions: notImplemented('products.adminListQuestions'),
      updateQuestionAdmin: notImplemented('products.updateQuestionAdmin'),
      listRelated: notImplemented('products.listRelated'),
      listRecommended: notImplemented('products.listRecommended'),
      adminList: notImplemented('products.adminList'),
      saveAdmin: notImplemented('products.saveAdmin'),
      deleteAdmin: notImplemented('products.deleteAdmin'),
    },
    brands: {
      list: notImplemented('brands.list'),
      getById: notImplemented('brands.getById'),
      getFeatured: notImplemented('brands.getFeatured'),
      adminList: notImplemented('brands.adminList'),
      saveAdmin: notImplemented('brands.saveAdmin'),
      deleteAdmin: notImplemented('brands.deleteAdmin'),
    },
    search: { recommendedKeywords: notImplemented('search.recommendedKeywords') },
    checkout: { getOptions: notImplemented('checkout.getOptions') },
    settings: {
      getAdmin: notImplemented('settings.getAdmin'),
      saveAdmin: notImplemented('settings.saveAdmin'),
    },
    categories: {
      list: notImplemented('categories.list'),
      adminList: notImplemented('categories.adminList'),
      save: notImplemented('categories.save'),
      delete: notImplemented('categories.delete'),
    },
    home: {
      getContent: notImplemented('home.getContent'),
      getAdminContent: notImplemented('home.getAdminContent'),
      saveAdminContent: notImplemented('home.saveAdminContent'),
    },
    company: {
      getInfo: notImplemented('company.getInfo'),
      getAdminInfo: notImplemented('company.getAdminInfo'),
      saveAdminInfo: notImplemented('company.saveAdminInfo'),
    },
    legalDocuments: {
      getPublished: notImplemented('legalDocuments.getPublished'),
      adminList: notImplemented('legalDocuments.adminList'),
      saveAdmin: notImplemented('legalDocuments.saveAdmin'),
    },
    orders: {
      adminList: notImplemented('orders.adminList'),
      adminGetById: notImplemented('orders.adminGetById'),
      updateAdmin: notImplemented('orders.updateAdmin'),
      listByMember: notImplemented('orders.listByMember'),
      getById: notImplemented('orders.getById'),
      create: notImplemented('orders.create'),
    },
    claims: {
      adminList: notImplemented('claims.adminList'),
      updateAdmin: notImplemented('claims.updateAdmin'),
      submit: notImplemented('claims.submit'),
      completeOrderCancellation: notImplemented('claims.completeOrderCancellation'),
      listByMember: notImplemented('claims.listByMember'),
    },
    coupons: {
      list: notImplemented('coupons.list'),
      historyList: notImplemented('coupons.historyList'),
      availableList: notImplemented('coupons.availableList'),
      acquire: notImplemented('coupons.acquire'),
      redeemCode: notImplemented('coupons.redeemCode'),
      adminList: notImplemented('coupons.adminList'),
      saveAdmin: notImplemented('coupons.saveAdmin'),
      deleteAdmin: notImplemented('coupons.deleteAdmin'),
    },
    points: {
      list: notImplemented('points.list'),
      adminList: notImplemented('points.adminList'),
      adjustAdmin: notImplemented('points.adjustAdmin'),
    },
    addresses: { list: notImplemented('addresses.list') },
    quotes: {
      submit: notImplemented('quotes.submit'),
      adminList: notImplemented('quotes.adminList'),
      updateAdmin: notImplemented('quotes.updateAdmin'),
      listByMember: notImplemented('quotes.listByMember'),
    },
    notices: {
      list: notImplemented('notices.list'),
      adminList: notImplemented('notices.adminList'),
      saveAdmin: notImplemented('notices.saveAdmin'),
      deleteAdmin: notImplemented('notices.deleteAdmin'),
    },
    events: {
      list: notImplemented('events.list'),
      getById: notImplemented('events.getById'),
      adminList: notImplemented('events.adminList'),
      saveAdmin: notImplemented('events.saveAdmin'),
      deleteAdmin: notImplemented('events.deleteAdmin'),
    },
    faqs: {
      list: notImplemented('faqs.list'),
      adminList: notImplemented('faqs.adminList'),
      saveAdmin: notImplemented('faqs.saveAdmin'),
      deleteAdmin: notImplemented('faqs.deleteAdmin'),
    },
    inquiries: {
      listByMember: notImplemented('inquiries.listByMember'),
      adminList: notImplemented('inquiries.adminList'),
      updateAdmin: notImplemented('inquiries.updateAdmin'),
    },
    members: {
      getCurrent: notImplemented('members.getCurrent'),
      list: notImplemented('members.list'),
      adminList: notImplemented('members.adminList'),
    },
  };
}
