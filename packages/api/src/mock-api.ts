import { collectCategoryIdsWithDescendants } from './category-tree';
import { resolveCartOption } from './cart';
import { assertMockAllowed, type ApiConfig } from './config';
import { ApiError } from './errors';
import { mockAddresses } from './mock/addresses';
import { mockAdminCoupons, mockAdminPoints, mockCoupons } from './mock/benefits';
import { mockBrands, type MockBrandRecord } from './mock/brands';
import { mockCategories } from './mock/categories';
import { mockCheckoutOptions } from './mock/checkout';
import { mockAdminShopSettings } from './mock/settings';
import { mockCompanyInfo } from './mock/company';
import {
  mockHeroSlides,
  mockHomeCtaBand,
  mockPromoBanners,
  mockServiceBenefits,
} from './mock/home';
import { mockMembers } from './mock/members';
import { mockClaims, mockOrders } from './mock/orders';
import { mockProducts } from './mock/products';
import { mockReviews } from './mock/reviews';
import { mockRecommendedKeywords } from './mock/search';
import {
  mockEvents,
  mockFaqs,
  mockInquiries,
  mockNotices,
  mockProductQuestions,
  mockQuotes,
} from './mock/support';
import type {
  AdminBrandInput,
  AdminCouponInput,
  AdminFaqInput,
  AdminInquiryUpdate,
  AdminProductReviewUpdate,
  AdminProductQuestionUpdate,
  AdminNoticeInput,
  AdminProductInput,
  QuoteSubmitInput,
  ProductFacetParams,
  RequestOptions,
  ShopApi,
} from './shop-api';
import type {
  AdminProduct,
  AdminCoupon,
  AdminPoint,
  AdminHomeContentInput,
  AdminShopEvent,
  AdminOrder,
  AdminClaim,
  ClaimSubmitInput,
  AdminQuote,
  AdminShopSettings,
  AdminFaq,
  AdminNotice,
  AdminInquiry,
  AdminProductReview,
  AdminProductQuestion,
  AdminLegalDocument,
  LegalDocumentId,
  CompanyInfo,
  Brand,
  BrandSummary,
  Category,
  CheckoutOptions,
  CreateOrderInput,
  FacetCount,
  HomeContent,
  OrderReceipt,
  Order,
  Member,
  Quote,
  PagedResult,
  Product,
  Coupon,
  CouponOffer,
  ProductFacets,
  ProductReview,
  ProductReviewSummary,
  ShopEvent,
} from './types';
import { canBuyNow } from './price';

const DEFAULT_PAGE_SIZE = 20;
/** 관련·추천 상품 기본 개수 */
const DEFAULT_COLLECTION_LIMIT = 10;

interface MockOwnedCoupon extends Coupon {
  memberId: string;
}

/** 관리자 목 원본에서 실제 가격을 구매자 응답으로 복사하지 않는 변환 함수 */
function toBuyerProduct(product: AdminProduct): Product {
  const {
    productCode: _productCode,
    stockCount: _stockCount,
    salesStatus: _salesStatus,
    isVisible: _isVisible,
    manufacturer: _manufacturer,
    material: _material,
    dimensions: _dimensions,
    weight: _weight,
    skus: adminSkus,
    ...buyerFields
  } = product;
  return {
    ...buyerFields,
    price: product.priceVisible ? product.price : null,
    listPrice: product.priceVisible ? product.listPrice : null,
    stockStatus:
      product.skus?.length &&
      product.skus.every((sku) => sku.salesStatus !== 'active' || sku.stockCount < 1)
        ? 'soldOut'
        : product.stockStatus,
    ...(adminSkus?.length
      ? {
          skus: adminSkus.map(({ productCode: _productCode, imageId, ...sku }) => ({
            id: sku.id,
            optionLabels: [...sku.optionLabels],
            priceDelta: sku.priceDelta,
            isAvailable: sku.salesStatus === 'active' && sku.stockCount > 0,
            imageUrl: product.images.find((image) => image.id === imageId)?.url ?? null,
          })),
        }
      : {}),
  };
}

/** 상위 카테고리를 조회할 때 그 하위 카테고리까지 포함합니다. */
function getCategoryIds(
  categories: readonly Category[],
  categoryId: string | undefined,
): Set<string> | null {
  if (categoryId === undefined) return null;
  return collectCategoryIdsWithDescendants(categories, categoryId);
}

/** 검색어가 상품명·브랜드에 들어 있는지 확인하는 함수(대소문자 무시) */
function matchesKeyword(product: AdminProduct, normalizedKeyword: string): boolean {
  return (
    normalizedKeyword === '' ||
    `${product.name} ${product.brand}`.toLowerCase().includes(normalizedKeyword)
  );
}

function isBuyerVisibleProduct(product: AdminProduct): boolean {
  return (
    product.isVisible !== false &&
    product.salesStatus !== 'paused' &&
    product.salesStatus !== 'ended'
  );
}

/** 카테고리 ID → 최상위 카테고리 ID 표. 검색 결과의 카테고리별 개수를 셀 때 씁니다. */
function buildTopLevelCategoryMap(categories: readonly Category[]): Map<string, string> {
  const parentIdByCategoryId = new Map(
    categories.map((category) => [category.id, category.parentId]),
  );
  const topLevelIdByCategoryId = new Map<string, string>();
  for (const category of categories) {
    let currentId = category.id;
    const visitedIds = new Set<string>();
    // 순환 참조가 있어도 끝나도록 방문한 ID를 기록합니다.
    while (!visitedIds.has(currentId)) {
      visitedIds.add(currentId);
      const parentId = parentIdByCategoryId.get(currentId);
      if (parentId === null || parentId === undefined) break;
      currentId = parentId;
    }
    topLevelIdByCategoryId.set(category.id, currentId);
  }
  return topLevelIdByCategoryId;
}

/** 값 목록을 개수와 함께 모으는 함수. 많은 순, 같으면 이름순으로 정렬합니다. */
function countValues(values: readonly string[]): FacetCount[] {
  const countByValue = new Map<string, number>();
  for (const facetValue of values) {
    countByValue.set(facetValue, (countByValue.get(facetValue) ?? 0) + 1);
  }
  return [...countByValue.entries()]
    .map(([facetValue, count]) => ({ value: facetValue, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, 'ko'));
}

/** 카테고리·검색어 범위의 필터 개수를 계산하는 함수 */
function buildFacets(
  products: readonly AdminProduct[],
  categories: readonly Category[],
  params: ProductFacetParams,
): ProductFacets {
  const normalizedKeyword = params.keyword?.trim().toLowerCase() ?? '';
  const keywordProducts = products.filter(
    (product) => isBuyerVisibleProduct(product) && matchesKeyword(product, normalizedKeyword),
  );
  const categoryIds = getCategoryIds(categories, params.categoryId);
  const scopedProducts = keywordProducts.filter(
    (product) => categoryIds === null || categoryIds.has(product.categoryId),
  );
  const topLevelIdByCategoryId = buildTopLevelCategoryMap(categories);
  return {
    totalCount: scopedProducts.length,
    keywordTotalCount: keywordProducts.length,
    // 카테고리 칩은 현재 카테고리 선택과 무관하게 검색어 범위 전체에서 셉니다.
    categories: countValues(
      keywordProducts.map(
        (product) => topLevelIdByCategoryId.get(product.categoryId) ?? product.categoryId,
      ),
    ),
    brands: countValues(scopedProducts.map((product) => product.brand)),
    certifications: countValues(scopedProducts.flatMap((product) => product.certifications)),
  };
}

/**
 * 관련 상품 목 규칙: 같은 상위 카테고리 상품을 먼저, 모자라면 베스트(isFeatured) 상품으로 채웁니다.
 * 기준 상품은 빼고, 기준 상품이 없으면 빈 목록입니다.
 */
function selectRelatedProducts(
  products: readonly AdminProduct[],
  categories: readonly Category[],
  productId: string,
  limit: number,
): AdminProduct[] {
  const baseProduct = products.find(
    (product) => product.id === productId && isBuyerVisibleProduct(product),
  );
  if (!baseProduct) return [];
  const topLevelIdByCategoryId = buildTopLevelCategoryMap(categories);
  const baseTopLevelId = topLevelIdByCategoryId.get(baseProduct.categoryId);
  const otherProducts = products.filter(
    (product) => product.id !== productId && isBuyerVisibleProduct(product),
  );
  const sameCategoryProducts = otherProducts.filter(
    (product) => topLevelIdByCategoryId.get(product.categoryId) === baseTopLevelId,
  );
  const fillerProducts = otherProducts.filter(
    (product) => product.isFeatured && !sameCategoryProducts.includes(product),
  );
  return [...sameCategoryProducts, ...fillerProducts].slice(0, limit);
}

/** 추천 상품 목 규칙: 베스트(isFeatured) 상품을 먼저, 모자라면 최신 상품으로 채웁니다. */
function selectRecommendedProducts(
  products: readonly AdminProduct[],
  limit: number,
): AdminProduct[] {
  const featuredProducts = products.filter(
    (product) => product.isFeatured && isBuyerVisibleProduct(product),
  );
  const newestProducts = products
    .filter((product) => !product.isFeatured && isBuyerVisibleProduct(product))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return [...featuredProducts, ...newestProducts].slice(0, limit);
}

/** 개수 조건을 1 이상의 정수로 맞추는 함수 */
function normalizeLimit(limit: number | undefined): number {
  return Math.max(1, Math.floor(limit ?? DEFAULT_COLLECTION_LIMIT));
}

/** 브랜드의 상품 수. 기존 상품 목록의 브랜드 이름 필터와 같은 기준으로 셉니다. */
function countBrandProducts(products: readonly AdminProduct[], brandName: string): number {
  return products.filter((product) => product.brand === brandName).length;
}

/** 관리자 설정 필드를 제외하고 상품 수를 붙여 구매자 상세 응답으로 바꿉니다. */
function toBuyerBrand(brandRecord: MockBrandRecord, products: readonly AdminProduct[]): Brand {
  const { isVisible: _isVisible, isFeatured: _isFeatured, ...brandFields } = brandRecord;
  return { ...brandFields, productCount: countBrandProducts(products, brandRecord.name) };
}

/** 구매자 목록 항목으로 줄입니다. */
function toBrandSummary(
  brandRecord: MockBrandRecord,
  products: readonly AdminProduct[],
): BrandSummary {
  return {
    id: brandRecord.id,
    name: brandRecord.name,
    englishName: brandRecord.englishName,
    logoUrl: brandRecord.logoUrl,
    tagline: brandRecord.tagline,
    productCount: countBrandProducts(products, brandRecord.name),
  };
}

/** 구매자에게 노출하는 브랜드만 반환합니다. */
function getVisibleBrands(brands: readonly MockBrandRecord[]): MockBrandRecord[] {
  return brands.filter((brandRecord) => brandRecord.isVisible);
}

function toBuyerEvent(event: AdminShopEvent): ShopEvent {
  const { isVisible: _isVisible, sortOrder: _sortOrder, ...buyerEvent } = event;
  return buyerEvent;
}

function toBuyerOrder(order: AdminOrder): Order {
  const {
    adminMemo: _adminMemo,
    statusHistory: _statusHistory,
    usedCouponId: _usedCouponId,
    memberId: _memberId,
    ...buyerOrder
  } = order;
  const { memberId: _addressMemberId, ...shippingAddress } =
    order.shippingAddress as Order['shippingAddress'] & { memberId?: string };
  return { ...buyerOrder, shippingAddress };
}

function toBuyerQuote(quote: AdminQuote): Quote {
  const { internalMemo: _internalMemo, attachments, ...buyerQuote } = quote;
  return {
    ...buyerQuote,
    requestedItems: structuredClone(quote.requestedItems),
    attachments: attachments.map(({ id, fileName, mimeType, sizeBytes }) => ({
      id,
      fileName,
      mimeType,
      sizeBytes,
    })),
  };
}

// 취소 신호를 fetch와 같은 AbortError로 바꾸는 함수
function createAbortError(): DOMException {
  return new DOMException('요청이 취소되었습니다.', 'AbortError');
}

// 설정한 지연 시간만큼 기다리는 함수. 기다리는 중 취소되면 AbortError로 끝냅니다.
function wait(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError());
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timerId);
      reject(createAbortError());
    };
    const timerId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

/**
 * 목 데이터로 ShopApi를 구현하는 함수(개발·검증 전용).
 * 운영에서 허용 플래그 없이 부르면 ApiConfigError를 던집니다.
 * 시나리오(normal/empty/error)와 지연 시간으로 로딩·빈·에러 상태를 재현하고,
 * 응답은 structuredClone으로 복사해서 화면이 목 원본을 바꾸지 못하게 합니다.
 */
export function createMockApi(
  config: ApiConfig,
  options: { getCurrentMember?: () => Promise<Member | null> } = {},
): ShopApi {
  assertMockAllowed(config);
  let orderSequence = 0;
  const products = structuredClone(mockProducts);
  const categories = structuredClone(mockCategories);
  const brands = structuredClone(mockBrands);
  const adminCoupons = structuredClone(mockAdminCoupons);
  const ownedCoupons: MockOwnedCoupon[] = structuredClone(mockCoupons).map((coupon) => ({
    ...coupon,
    memberId: 'mem-001',
  }));
  for (const definition of adminCoupons) {
    const seededCoupons = ownedCoupons.filter((coupon) => coupon.adminCouponId === definition.id);
    definition.issuedCount = Math.max(definition.issuedCount, seededCoupons.length);
    definition.usedCount = Math.max(
      definition.usedCount,
      seededCoupons.filter((coupon) => coupon.isUsed).length,
    );
  }
  const members = structuredClone(mockMembers);
  const getCurrentMember = async (): Promise<Member> => {
    const sessionMember = options.getCurrentMember
      ? await options.getCurrentMember()
      : (members.find((member) => member.id === 'mem-001') ?? null);
    if (!sessionMember) throw new ApiError('NOT_FOUND', '로그인한 회원 정보를 찾을 수 없습니다.');
    const storedMember = members.find((member) => member.id === sessionMember.id);
    if (storedMember) return storedMember;
    const transientMember = structuredClone(sessionMember);
    members.push(transientMember);
    return transientMember;
  };
  const assertCurrentMember = async (memberId: string): Promise<Member> => {
    const currentMember = await getCurrentMember();
    if (currentMember.id !== memberId)
      throw new ApiError('NOT_FOUND', '요청한 정보를 찾을 수 없습니다.');
    return currentMember;
  };
  const adminPoints = structuredClone(mockAdminPoints);
  let adminSettings: AdminShopSettings = structuredClone(mockAdminShopSettings);
  const adminNotices: AdminNotice[] = structuredClone(mockNotices).map((notice, index) => ({
    ...notice,
    isVisible: true,
    sortOrder: index,
  }));
  const adminFaqs: AdminFaq[] = structuredClone(mockFaqs).map((faq, index) => ({
    ...faq,
    isVisible: true,
    sortOrder: index,
  }));
  const inquiries: AdminInquiry[] = structuredClone(mockInquiries).map((inquiry) => ({
    ...inquiry,
    adminMemo: '',
    statusHistory: [{ status: inquiry.status, occurredAt: inquiry.createdAt, note: '문의 접수' }],
  }));
  const productReviews: AdminProductReview[] = structuredClone(mockReviews).map((review) => ({
    ...review,
    isVisible: true,
    adminReply: '',
    adminMemo: '',
  }));
  const productQuestions: AdminProductQuestion[] = structuredClone(mockProductQuestions);
  let companyInfo: CompanyInfo = structuredClone(mockCompanyInfo);
  const legalDocuments: AdminLegalDocument[] = [];
  const orders: AdminOrder[] = structuredClone(mockOrders).map((order) => ({
    ...order,
    memberId: order.memberId ?? 'mem-001',
    trackingCarrier: null,
    trackingNumber: null,
    adminMemo: '',
    statusHistory: [{ status: order.status, occurredAt: order.orderedAt, note: '주문 접수' }],
  }));
  const claims: AdminClaim[] = structuredClone(mockClaims).map((claim) => ({
    ...claim,
    adminMemo: '',
    statusHistory: [{ status: claim.status, occurredAt: claim.requestedAt, note: '요청 접수' }],
  }));
  const quotes: AdminQuote[] = structuredClone(mockQuotes).map((quote) => ({
    ...quote,
    inquiryBody: '',
    requestedItems: [],
    attachments: [],
    internalMemo: '',
    publicMessage: null,
    quoteAmount: null,
    expiresAt: null,
  }));
  const events: AdminShopEvent[] = structuredClone(mockEvents).map((event, index) => ({
    ...event,
    isVisible: true,
    sortOrder: index,
  }));
  let homeContent: AdminHomeContentInput = {
    heroSlides: structuredClone(mockHeroSlides),
    promoBanners: structuredClone(mockPromoBanners),
    serviceBenefits: structuredClone(mockServiceBenefits),
    featuredProductIds: products
      .filter((product) => product.isFeatured)
      .map((product) => product.id),
    ctaBand: structuredClone(mockHomeCtaBand),
  };
  let productSequence = products.length + 1;
  let categorySequence = categories.length + 1;
  let brandSequence = brands.length + 1;
  let eventSequence = events.length + 1;
  let quoteSequence = quotes.length + 1;
  let ownedCouponSequence = ownedCoupons.length + 1;
  let adminCouponSequence = adminCoupons.length + 1;
  let pointSequence = adminPoints.length + 1;
  const orderReceiptsByIdempotencyKey = new Map<
    string,
    { fingerprint: string; receipt: OrderReceipt }
  >();
  const inFlightOrdersByIdempotencyKey = new Map<
    string,
    { fingerprint: string; promise: Promise<OrderReceipt> }
  >();
  let claimSequence = claims.length + 1;

  async function prepareMutation(options: RequestOptions | undefined, entityName: string) {
    await wait(config.mockLatencyMs, options?.signal);
    if (config.mockScenario === 'error') {
      throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
    }
    if (config.mockScenario === 'empty') {
      throw new ApiError(
        'VALIDATION',
        `${entityName} 목 데이터를 수정할 수 없는 빈 시나리오입니다.`,
      );
    }
  }

  const couponToday = () => new Date().toISOString().slice(0, 10);
  const couponExpiry = (coupon: AdminCoupon) => {
    if (coupon.validityMode === 'issueDays') {
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + Math.max(1, coupon.validityDays ?? 1));
      return `${expiration.toISOString().slice(0, 10)}T23:59:59+09:00`;
    }
    return `${coupon.endsAt}T23:59:59+09:00`;
  };
  const isCouponAvailableToMockBuyer = (coupon: AdminCoupon) => {
    const today = couponToday();
    return (
      coupon.status === 'active' &&
      coupon.target === 'all' &&
      coupon.productScope === 'all' &&
      (coupon.validityMode === 'issueDays' || (coupon.startsAt <= today && coupon.endsAt >= today))
    );
  };
  const findOwnedCoupon = (memberId: string, adminCouponId: string) =>
    ownedCoupons.find(
      (ownedCoupon) =>
        ownedCoupon.memberId === memberId && ownedCoupon.adminCouponId === adminCouponId,
    );
  const issueOwnedCoupon = (coupon: AdminCoupon, memberId: string): MockOwnedCoupon => {
    const existing = findOwnedCoupon(memberId, coupon.id);
    if (existing) return existing;
    if (!isCouponAvailableToMockBuyer(coupon))
      throw new ApiError('VALIDATION', '현재 획득할 수 없는 쿠폰입니다.');
    if (coupon.issueLimit !== null && coupon.issuedCount >= coupon.issueLimit)
      throw new ApiError('VALIDATION', '쿠폰 발급 수량이 모두 소진되었습니다.');
    const ownedCoupon: MockOwnedCoupon = {
      id: `cpn-admin-${ownedCouponSequence++}`,
      adminCouponId: coupon.id,
      memberId,
      name: coupon.name,
      discountType: coupon.benefitType,
      discountValue: coupon.benefitValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderAmount: coupon.minimumOrderAmount,
      expiresAt: couponExpiry(coupon),
      isUsed: false,
    };
    ownedCoupons.unshift(ownedCoupon);
    coupon.issuedCount += 1;
    return ownedCoupon;
  };
  const grantAutomaticCoupons = (memberId: string) => {
    for (const coupon of adminCoupons) {
      if (coupon.issueMethod === 'automatic' && isCouponAvailableToMockBuyer(coupon))
        issueOwnedCoupon(coupon, memberId);
    }
  };
  const toBuyerCoupon = (ownedCoupon: MockOwnedCoupon, catalogCoupon?: AdminCoupon): Coupon => {
    const { adminCouponId: _adminCouponId, memberId: _memberId, ...publicCoupon } = ownedCoupon;
    if (!catalogCoupon) return publicCoupon;
    return {
      ...publicCoupon,
      name: catalogCoupon.name,
      discountType: catalogCoupon.benefitType,
      discountValue: catalogCoupon.benefitValue,
      maxDiscountAmount: catalogCoupon.maxDiscountAmount,
      minOrderAmount: catalogCoupon.minimumOrderAmount,
      expiresAt: couponExpiry(catalogCoupon),
    };
  };
  function getOwnedBuyerCoupons(memberId: string): Coupon[] {
    grantAutomaticCoupons(memberId);
    return ownedCoupons
      .filter((ownedCoupon) => ownedCoupon.memberId === memberId)
      .flatMap((ownedCoupon) => {
        const catalogCoupon = adminCoupons.find(
          (coupon) => coupon.id === ownedCoupon.adminCouponId,
        );
        if (!catalogCoupon) return [];
        return [toBuyerCoupon(ownedCoupon, catalogCoupon)];
      });
  }
  function getCheckoutBuyerCoupons(memberId: string): Coupon[] {
    const today = couponToday();
    return getOwnedBuyerCoupons(memberId).filter((ownedCoupon) => {
      const privateOwnedCoupon = ownedCoupons.find((item) => item.id === ownedCoupon.id);
      const catalogCoupon = adminCoupons.find(
        (coupon) => coupon.id === privateOwnedCoupon?.adminCouponId,
      );
      return (
        !ownedCoupon.isUsed &&
        Boolean(catalogCoupon && isCouponAvailableToMockBuyer(catalogCoupon)) &&
        ownedCoupon.expiresAt.slice(0, 10) >= today
      );
    });
  }
  function getAvailableCouponOffers(memberId: string): CouponOffer[] {
    grantAutomaticCoupons(memberId);
    return adminCoupons
      .filter(isCouponAvailableToMockBuyer)
      .filter(
        (coupon) =>
          coupon.issuedCount < (coupon.issueLimit ?? Number.POSITIVE_INFINITY) ||
          Boolean(findOwnedCoupon(memberId, coupon.id)),
      )
      .map((coupon) => ({
        id: coupon.id,
        name: coupon.name,
        discountType: coupon.benefitType,
        discountValue: coupon.benefitValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minimumOrderAmount,
        expiresAt: couponExpiry(coupon),
        issueMethod: coupon.issueMethod,
        isAcquired: Boolean(findOwnedCoupon(memberId, coupon.id)),
      }));
  }

  // 목록 응답: 지연 → 에러/빈 시나리오 처리 → 복사본 반환
  async function respondList<TItem>(
    items: readonly TItem[],
    options: RequestOptions = {},
  ): Promise<TItem[]> {
    await wait(config.mockLatencyMs, options.signal);
    if (config.mockScenario === 'error') {
      throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
    }
    if (config.mockScenario === 'empty') return [];
    return structuredClone([...items]);
  }

  // 단건 응답: 없으면 NOT_FOUND
  async function respondOne<TItem>(
    found: TItem | undefined,
    entityName: string,
    options: RequestOptions = {},
  ): Promise<TItem> {
    await wait(config.mockLatencyMs, options.signal);
    if (config.mockScenario === 'error') {
      throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
    }
    if (found === undefined || config.mockScenario === 'empty') {
      throw new ApiError('NOT_FOUND', `${entityName}을(를) 찾을 수 없습니다.`);
    }
    return structuredClone(found);
  }

  return {
    products: {
      async list(params = {}, options): Promise<PagedResult<Product>> {
        const keyword = params.keyword?.trim().toLowerCase() ?? '';
        const categoryIds = getCategoryIds(categories, params.categoryId);
        const brandFilters = new Set(params.brand ?? []);
        const certificationFilters = new Set(params.certification ?? []);
        const filteredProducts = products.filter((product) => {
          if (!isBuyerVisibleProduct(product)) return false;
          const matchesCategory = categoryIds === null || categoryIds.has(product.categoryId);
          const matchesBrand = brandFilters.size === 0 || brandFilters.has(product.brand);
          const matchesCertification =
            certificationFilters.size === 0 ||
            [...certificationFilters].some((certification) =>
              product.certifications.includes(certification),
            );
          const matchesPrice =
            params.minPrice === undefined && params.maxPrice === undefined
              ? true
              : product.priceVisible &&
                (params.minPrice === undefined || product.price >= params.minPrice) &&
                (params.maxPrice === undefined || product.price <= params.maxPrice);
          const matchesStock = !params.excludeSoldOut || product.stockStatus !== 'soldOut';
          return (
            matchesCategory &&
            matchesKeyword(product, keyword) &&
            matchesBrand &&
            matchesCertification &&
            matchesPrice &&
            matchesStock
          );
        });
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
        const allItems = await respondList(filteredProducts, options);
        const sortedItems = [...allItems];
        sortedItems.sort((left, right) => {
          const leftIsSoldOut = left.stockStatus === 'soldOut';
          const rightIsSoldOut = right.stockStatus === 'soldOut';
          if (leftIsSoldOut !== rightIsSoldOut) return leftIsSoldOut ? 1 : -1;

          if (params.sortBy === 'priceAsc' || params.sortBy === 'priceDesc') {
            const direction = params.sortBy === 'priceAsc' ? 1 : -1;
            const leftPrice = left.priceVisible ? left.price : null;
            const rightPrice = right.priceVisible ? right.price : null;
            if (leftPrice === null) return rightPrice === null ? 0 : 1;
            if (rightPrice === null) return -1;
            return (leftPrice - rightPrice) * direction;
          }
          if (params.sortBy === 'newest') {
            return right.createdAt.localeCompare(left.createdAt);
          }
          if (params.sortBy === 'ratingDesc') {
            if (left.rating === null) return right.rating === null ? 0 : 1;
            if (right.rating === null) return -1;
            return right.rating - left.rating;
          }
          return 0;
        });
        return {
          items: sortedItems.slice((page - 1) * pageSize, page * pageSize).map(toBuyerProduct),
          page,
          pageSize,
          totalCount: sortedItems.length,
        };
      },
      async getById(productId, options) {
        return toBuyerProduct(
          await respondOne(
            products.find((product) => product.id === productId && isBuyerVisibleProduct(product)),
            '상품',
            options,
          ),
        );
      },
      async suggest(keyword, options) {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (normalizedKeyword === '') return [];
        const matches = products
          .filter(isBuyerVisibleProduct)
          .filter((product) => matchesKeyword(product, normalizedKeyword))
          .slice(0, 5)
          .map(({ id, name, brand }) => ({ productId: id, name, brand }));
        return respondList(matches, options);
      },
      async facets(params = {}, options): Promise<ProductFacets> {
        await wait(config.mockLatencyMs, options?.signal);
        if (config.mockScenario === 'error') {
          throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
        }
        if (config.mockScenario === 'empty') {
          return {
            totalCount: 0,
            keywordTotalCount: 0,
            categories: [],
            brands: [],
            certifications: [],
          };
        }
        return buildFacets(products, categories, params);
      },
      async listRelated(productId, params = {}, options): Promise<Product[]> {
        const relatedProducts = await respondList(
          selectRelatedProducts(products, categories, productId, normalizeLimit(params.limit)),
          options,
        );
        return relatedProducts.map(toBuyerProduct);
      },
      async listRecommended(params = {}, options): Promise<Product[]> {
        const recommendedProducts = await respondList(
          selectRecommendedProducts(products, normalizeLimit(params.limit)),
          options,
        );
        return recommendedProducts.map(toBuyerProduct);
      },
      async listReviews(productId, params = {}, options): Promise<PagedResult<ProductReview>> {
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
        const productReviewsPage = await respondList(
          productReviews
            .filter((review) => review.isVisible)
            .filter((review) => review.productId === productId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(({ isVisible: _isVisible, adminMemo: _adminMemo, adminReply, ...review }) => ({
              ...review,
              ...(adminReply.trim() ? { adminReply } : {}),
            })),
          options,
        );
        return {
          items: productReviewsPage.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          totalCount: productReviewsPage.length,
        };
      },
      async getReviewSummary(productId, options): Promise<ProductReviewSummary> {
        const visibleProductReviews = await respondList(
          productReviews.filter((review) => review.isVisible && review.productId === productId),
          options,
        );
        const ratingCounts: ProductReviewSummary['ratingCounts'] = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };
        let ratingTotal = 0;
        for (const review of visibleProductReviews) {
          switch (review.rating) {
            case 1:
              ratingCounts[1] += 1;
              ratingTotal += 1;
              break;
            case 2:
              ratingCounts[2] += 1;
              ratingTotal += 2;
              break;
            case 3:
              ratingCounts[3] += 1;
              ratingTotal += 3;
              break;
            case 4:
              ratingCounts[4] += 1;
              ratingTotal += 4;
              break;
            case 5:
              ratingCounts[5] += 1;
              ratingTotal += 5;
              break;
          }
        }
        return {
          productId,
          averageRating:
            visibleProductReviews.length === 0
              ? null
              : Math.round((ratingTotal / visibleProductReviews.length) * 10) / 10,
          totalCount: visibleProductReviews.length,
          ratingCounts,
          photoReviewCount: 0,
        };
      },
      adminList(options) {
        return respondList(products, options);
      },
      adminListReviews(options) {
        return respondList(
          [...productReviews].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
          options,
        );
      },
      async updateReviewAdmin(reviewId, update: AdminProductReviewUpdate, options) {
        await prepareMutation(options, '상품 리뷰');
        const review = productReviews.find((item) => item.id === reviewId);
        if (!review) throw new ApiError('NOT_FOUND', '상품 리뷰를 찾을 수 없습니다.');
        if (update.adminReply !== undefined && update.adminReply.length > 2000)
          throw new ApiError('VALIDATION', '공개 답변은 2,000자 이내로 입력해 주세요.');
        if (update.adminMemo !== undefined && update.adminMemo.length > 2000)
          throw new ApiError('VALIDATION', '내부 메모는 2,000자 이내로 입력해 주세요.');
        Object.assign(review, structuredClone(update));
        return structuredClone(review);
      },
      async listQuestions(productId, options) {
        return respondList(
          productQuestions
            .filter((question) => question.productId === productId)
            .filter((question) => !question.isPrivate)
            .map(
              ({ adminMemo: _adminMemo, statusHistory: _statusHistory, ...question }) => question,
            ),
          options,
        );
      },
      adminListQuestions(options) {
        return respondList(
          [...productQuestions].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          ),
          options,
        );
      },
      async updateQuestionAdmin(questionId, update: AdminProductQuestionUpdate, options) {
        await prepareMutation(options, '상품 문의');
        const question = productQuestions.find((item) => item.id === questionId);
        if (!question) throw new ApiError('NOT_FOUND', '상품 문의를 찾을 수 없습니다.');
        if (typeof update.answer === 'string' && update.answer.length > 5000)
          throw new ApiError('VALIDATION', '공개 답변은 5,000자 이내로 입력해 주세요.');
        if (update.adminMemo !== undefined && update.adminMemo.length > 2000)
          throw new ApiError('VALIDATION', '내부 메모는 2,000자 이내로 입력해 주세요.');
        if (update.status === 'answered' && !(update.answer ?? question.answer)?.trim())
          throw new ApiError('VALIDATION', '답변을 입력한 뒤 완료 처리해 주세요.');
        const previousStatus = question.status;
        Object.assign(question, structuredClone(update));
        if (update.status && update.status !== previousStatus)
          question.statusHistory.push({
            status: update.status,
            occurredAt: new Date().toISOString(),
            note: update.status === 'answered' ? '답변 등록' : '답변 상태 변경',
          });
        return structuredClone(question);
      },
      async saveAdmin(input: AdminProductInput, options) {
        await prepareMutation(options, '상품');
        if (!input.name.trim() || !input.brand.trim() || !input.categoryId) {
          throw new ApiError('VALIDATION', '상품명·브랜드·카테고리를 입력해 주세요.');
        }
        if (!Number.isFinite(input.price) || input.price < 0) {
          throw new ApiError('VALIDATION', '판매가를 확인해 주세요.');
        }
        if (!categories.some((category) => category.id === input.categoryId)) {
          throw new ApiError('VALIDATION', '존재하는 카테고리를 선택해 주세요.');
        }
        const existingProduct = input.id
          ? products.find((product) => product.id === input.id)
          : undefined;
        if (input.id && !existingProduct)
          throw new ApiError('NOT_FOUND', '상품을 찾을 수 없습니다.');
        const nextProduct: AdminProduct = {
          ...structuredClone(input),
          id: input.id ?? `prd-admin-${String(productSequence++).padStart(4, '0')}`,
          createdAt: existingProduct?.createdAt ?? new Date().toISOString(),
          rating: existingProduct?.rating ?? null,
          reviewCount: existingProduct?.reviewCount ?? 0,
          isVisible: input.isVisible ?? true,
          salesStatus: input.salesStatus ?? (input.stockStatus === 'soldOut' ? 'paused' : 'active'),
          stockCount: Math.max(0, Math.floor(input.stockCount ?? 0)),
          productCode: input.productCode?.trim() || input.id || `SKU-${productSequence}`,
          skus: input.skus ?? [],
        };
        const existingIndex = products.findIndex((product) => product.id === nextProduct.id);
        if (existingIndex < 0) products.unshift(nextProduct);
        else products[existingIndex] = nextProduct;
        const featuredProductIds = new Set(homeContent.featuredProductIds);
        if (nextProduct.isFeatured) featuredProductIds.add(nextProduct.id);
        else featuredProductIds.delete(nextProduct.id);
        homeContent.featuredProductIds = [...featuredProductIds];
        return structuredClone(nextProduct);
      },
      async deleteAdmin(productId, options) {
        await prepareMutation(options, '상품');
        const existingIndex = products.findIndex((product) => product.id === productId);
        if (existingIndex < 0) throw new ApiError('NOT_FOUND', '상품을 찾을 수 없습니다.');
        products.splice(existingIndex, 1);
        homeContent.featuredProductIds = homeContent.featuredProductIds.filter(
          (id) => id !== productId,
        );
      },
    },
    brands: {
      list: (options) =>
        respondList(
          getVisibleBrands(brands).map((brand) => toBrandSummary(brand, products)),
          options,
        ),
      async getById(brandId, options): Promise<Brand> {
        const brandRecord = await respondOne(
          getVisibleBrands(brands).find((visibleBrand) => visibleBrand.id === brandId),
          '브랜드',
          options,
        );
        return toBuyerBrand(brandRecord, products);
      },
      async getFeatured(options): Promise<Brand | null> {
        await wait(config.mockLatencyMs, options?.signal);
        if (config.mockScenario === 'error') {
          throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
        }
        if (config.mockScenario === 'empty') return null;
        const featuredBrand = getVisibleBrands(brands).find(
          (visibleBrand) => visibleBrand.isFeatured,
        );
        return featuredBrand ? structuredClone(toBuyerBrand(featuredBrand, products)) : null;
      },
      adminList: (options) =>
        respondList(
          brands.map((brand) => ({
            ...brand,
            productCount: countBrandProducts(products, brand.name),
          })),
          options,
        ),
      async saveAdmin(input: AdminBrandInput, options) {
        await prepareMutation(options, '브랜드');
        if (!input.name.trim()) throw new ApiError('VALIDATION', '브랜드명을 입력해 주세요.');
        if (
          brands.some(
            (brand) =>
              brand.id !== input.id &&
              brand.name.toLocaleLowerCase('ko-KR') ===
                input.name.trim().toLocaleLowerCase('ko-KR'),
          )
        ) {
          throw new ApiError('VALIDATION', '이미 등록된 브랜드명입니다.');
        }
        const currentBrand = brands.find((brand) => brand.id === input.id);
        if (
          currentBrand &&
          currentBrand.name !== input.name.trim() &&
          products.some((product) => product.brand === currentBrand.name)
        ) {
          throw new ApiError('VALIDATION', '상품에 연결된 브랜드명은 변경할 수 없습니다.');
        }
        if (input.isFeatured && !input.isVisible) {
          throw new ApiError('VALIDATION', '대표 브랜드는 웹에 노출되어야 합니다.');
        }
        const existingIndex = brands.findIndex((brand) => brand.id === input.id);
        const nextBrand: MockBrandRecord = {
          ...structuredClone(input),
          id: input.id ?? `brd-admin-${String(brandSequence++).padStart(4, '0')}`,
          isVisible: input.isVisible ?? true,
          isFeatured: input.isFeatured ?? false,
        };
        if (nextBrand.isFeatured)
          brands.forEach((brand) => {
            brand.isFeatured = false;
          });
        if (existingIndex < 0) brands.unshift(nextBrand);
        else brands[existingIndex] = nextBrand;
        return structuredClone({
          ...nextBrand,
          productCount: countBrandProducts(products, nextBrand.name),
        });
      },
      async deleteAdmin(brandId, options) {
        await prepareMutation(options, '브랜드');
        const brand = brands.find((record) => record.id === brandId);
        if (!brand) throw new ApiError('NOT_FOUND', '브랜드를 찾을 수 없습니다.');
        if (brand.isFeatured) {
          throw new ApiError('VALIDATION', '대표 브랜드 지정을 해제한 뒤 삭제해 주세요.');
        }
        if (products.some((product) => product.brand === brand.name)) {
          throw new ApiError('VALIDATION', '상품에 연결된 브랜드는 삭제할 수 없습니다.');
        }
        brands.splice(brands.indexOf(brand), 1);
      },
    },
    search: {
      recommendedKeywords: (options) => respondList(mockRecommendedKeywords, options),
    },
    checkout: {
      async getOptions(options): Promise<CheckoutOptions> {
        return respondOne(
          {
            ...mockCheckoutOptions,
            shippingFee: adminSettings.baseShippingFee,
            freeShippingThreshold: adminSettings.freeShippingEnabled
              ? adminSettings.freeShippingThreshold
              : 0,
            freeShippingScope: adminSettings.freeShippingScope,
            baseFeeMode: adminSettings.baseFeeMode,
          },
          '주문서 선택지',
          options,
        );
      },
    },
    settings: {
      getAdmin: (options) => respondOne(adminSettings, '운영 설정', options),
      async saveAdmin(input: AdminShopSettings, options) {
        await prepareMutation(options, '운영 설정');
        const numericValues = [
          input.baseShippingFee,
          input.freeShippingThreshold,
          input.jejuFee,
          input.islandFee,
          input.returnFee,
          input.exchangeFee,
          input.businessDiscountRate,
          input.firstPurchaseBenefitValue,
          input.firstPurchaseMaxDiscount,
          input.firstPurchaseMinimumOrder,
        ];
        if (numericValues.some((value) => !Number.isFinite(value) || value < 0))
          throw new ApiError(
            'VALIDATION',
            '배송·할인 정책의 금액과 비율은 0 이상의 숫자여야 합니다.',
          );
        if (
          input.businessDiscountRate > 100 ||
          (input.firstPurchaseBenefitType === 'rate' && input.firstPurchaseBenefitValue > 100)
        )
          throw new ApiError('VALIDATION', '할인율은 100% 이하여야 합니다.');
        adminSettings = structuredClone(input);
        return structuredClone(adminSettings);
      },
    },
    categories: {
      list: (options) =>
        respondList(
          categories.filter((category) => category.isVisible !== false),
          options,
        ),
      adminList: (options) => respondList(categories, options),
      async save(input, options) {
        await prepareMutation(options, '카테고리');
        if (!input.name.trim() || !input.slug.trim()) {
          throw new ApiError('VALIDATION', '카테고리명과 주소 키를 입력해 주세요.');
        }
        if (input.parentId && !categories.some((category) => category.id === input.parentId)) {
          throw new ApiError('VALIDATION', '상위 카테고리를 확인해 주세요.');
        }
        const nextCategory: Category = {
          ...structuredClone(input),
          id: input.id ?? `cat-admin-${String(categorySequence++).padStart(4, '0')}`,
          isVisible: input.isVisible ?? true,
        };
        if (nextCategory.parentId === nextCategory.id) {
          throw new ApiError('VALIDATION', '자기 자신을 상위 카테고리로 지정할 수 없습니다.');
        }
        const existingIndex = categories.findIndex((category) => category.id === nextCategory.id);
        if (existingIndex < 0) categories.push(nextCategory);
        else categories[existingIndex] = nextCategory;
        return structuredClone(nextCategory);
      },
      async delete(categoryId, options) {
        await prepareMutation(options, '카테고리');
        if (categories.some((category) => category.parentId === categoryId)) {
          throw new ApiError('VALIDATION', '하위 카테고리를 먼저 이동하거나 삭제해 주세요.');
        }
        if (products.some((product) => product.categoryId === categoryId)) {
          throw new ApiError('VALIDATION', '상품에 연결된 카테고리는 삭제할 수 없습니다.');
        }
        const existingIndex = categories.findIndex((category) => category.id === categoryId);
        if (existingIndex < 0) throw new ApiError('NOT_FOUND', '카테고리를 찾을 수 없습니다.');
        categories.splice(existingIndex, 1);
      },
    },
    home: {
      async getContent(options): Promise<HomeContent> {
        await wait(config.mockLatencyMs, options?.signal);
        if (config.mockScenario === 'error') {
          throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
        }
        if (config.mockScenario === 'empty') {
          return {
            heroSlides: [],
            promoBanners: [],
            serviceBenefits: [],
            featuredProducts: [],
            ctaBand: null,
          };
        }
        return structuredClone({
          heroSlides: homeContent.heroSlides,
          promoBanners: homeContent.promoBanners,
          serviceBenefits: homeContent.serviceBenefits,
          featuredProducts: homeContent.featuredProductIds
            .map((productId) => products.find((product) => product.id === productId))
            .filter((product): product is AdminProduct =>
              Boolean(product && isBuyerVisibleProduct(product)),
            )
            .map(toBuyerProduct),
          ctaBand: homeContent.ctaBand,
        });
      },
      getAdminContent: (options) => respondOne(homeContent, '홈 편성', options),
      async saveAdminContent(input, options) {
        await prepareMutation(options, '홈 편성');
        const heroIds = input.heroSlides.map((slide) => slide.id);
        const promoIds = input.promoBanners.map((banner) => banner.id);
        if (
          new Set(heroIds).size !== heroIds.length ||
          new Set(promoIds).size !== promoIds.length
        ) {
          throw new ApiError('VALIDATION', '홈 콘텐츠 ID가 중복되었습니다.');
        }
        if (
          input.featuredProductIds.some(
            (productId) => !products.some((product) => product.id === productId),
          )
        ) {
          throw new ApiError('VALIDATION', '홈 추천 상품에 없는 상품 ID가 포함되어 있습니다.');
        }
        const isSafeDestination = (destination: string) =>
          /^\/(?!\/)/.test(destination) || /^https?:\/\//i.test(destination);
        if (
          input.heroSlides.some(
            (slide) =>
              !slide.eyebrow.trim() ||
              !slide.imageUrl.trim() ||
              !isSafeDestination(slide.destination),
          ) ||
          input.promoBanners.some(
            (banner) => !banner.imageUrl.trim() || !isSafeDestination(banner.destination),
          )
        ) {
          throw new ApiError('VALIDATION', '홈 배너의 이미지와 이동 경로를 확인해 주세요.');
        }
        if (
          input.ctaBand &&
          (!input.ctaBand.title.trim() ||
            !input.ctaBand.cta.label.trim() ||
            !isSafeDestination(input.ctaBand.cta.destination))
        ) {
          throw new ApiError('VALIDATION', '홈 CTA 문구와 이동 경로를 확인해 주세요.');
        }
        homeContent = structuredClone(input);
        products.forEach((product) => {
          product.isFeatured = homeContent.featuredProductIds.includes(product.id);
        });
        return structuredClone(homeContent);
      },
    },
    company: {
      getInfo: (options) => respondOne(companyInfo, '사업자 정보', options),
      getAdminInfo: (options) => respondOne(companyInfo, '사업자 정보', options),
      async saveAdminInfo(input, options) {
        await prepareMutation(options, '사업자 정보');
        const requiredValues = [
          input.companyName,
          input.representative,
          input.businessRegistrationNumber,
          input.address,
          input.email,
          input.customerCenterPhone,
          input.customerCenterHours,
        ];
        if (requiredValues.some((value) => !value.trim()))
          throw new ApiError('VALIDATION', '필수 사업자·고객센터 정보를 입력해 주세요.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
          throw new ApiError('VALIDATION', '사업자 이메일 형식을 확인해 주세요.');
        companyInfo = structuredClone(input);
        return structuredClone(companyInfo);
      },
    },
    legalDocuments: {
      getPublished(documentId: LegalDocumentId, options) {
        return respondOne(
          legalDocuments.find((document) => document.id === documentId && document.isPublished),
          '공개 문서',
          options,
        );
      },
      adminList: (options) => respondList(legalDocuments, options),
      async saveAdmin(input: AdminLegalDocument, options) {
        await prepareMutation(options, '약관·정책 문서');
        if (
          !input.title.trim() ||
          !input.version.trim() ||
          !input.effectiveAt.trim() ||
          !input.body.trim()
        )
          throw new ApiError('VALIDATION', '문서명, 버전, 시행일, 본문을 입력해 주세요.');
        if (Number.isNaN(Date.parse(input.effectiveAt)))
          throw new ApiError('VALIDATION', '시행일을 확인해 주세요.');
        const current = legalDocuments.find((document) => document.id === input.id);
        const saved = structuredClone(input);
        if (current) legalDocuments[legalDocuments.indexOf(current)] = saved;
        else legalDocuments.push(saved);
        return structuredClone(saved);
      },
    },
    orders: {
      adminList: (options) => respondList(orders, options),
      adminGetById: (orderId, options) =>
        respondOne(
          orders.find((order) => order.id === orderId),
          '주문',
          options,
        ),
      async updateAdmin(orderId, update, options) {
        await prepareMutation(options, '주문');
        const order = orders.find((item) => item.id === orderId);
        if (!order) throw new ApiError('NOT_FOUND', '주문을 찾을 수 없습니다.');
        const nextCarrier = update.trackingCarrier?.trim() ?? order.trackingCarrier;
        const nextTracking = update.trackingNumber?.trim() ?? order.trackingNumber;
        const nextStatus = update.status ?? order.status;
        if (nextStatus === 'shipping' && (!nextCarrier || !nextTracking)) {
          throw new ApiError('VALIDATION', '배송중 처리에는 택배사와 송장번호가 필요합니다.');
        }
        if (update.status && update.status !== order.status) {
          order.statusHistory.push({
            status: update.status,
            occurredAt: new Date().toISOString(),
            note: '관리자 상태 변경',
          });
          order.status = update.status;
        }
        if (update.trackingCarrier !== undefined) order.trackingCarrier = nextCarrier;
        if (update.trackingNumber !== undefined) order.trackingNumber = nextTracking;
        if (update.adminMemo !== undefined) order.adminMemo = update.adminMemo.trim();
        return structuredClone(order);
      },
      async listByMember(memberId, options) {
        await assertCurrentMember(memberId);
        return respondList(
          orders.filter((order) => order.memberId === memberId).map(toBuyerOrder),
          options,
        );
      },
      async getById(orderId, options) {
        const currentMember = await getCurrentMember();
        const order = orders.find(
          (candidate) => candidate.id === orderId && candidate.memberId === currentMember.id,
        );
        return respondOne(order ? toBuyerOrder(order) : undefined, '주문', options);
      },
      async create(input: CreateOrderInput, options): Promise<OrderReceipt> {
        const buyerMember = await getCurrentMember();
        const key = input.idempotencyKey?.trim();
        if (input.idempotencyKey !== undefined && !key)
          throw new ApiError('VALIDATION', '주문 재시도 키가 비어 있습니다.');
        const { idempotencyKey: _idempotencyKey, ...requestPayload } = input;
        const fingerprint = JSON.stringify(requestPayload);
        const scopedKey = key ? `${buyerMember.id}:${key}` : undefined;
        if (scopedKey) {
          const previousRequest = orderReceiptsByIdempotencyKey.get(scopedKey);
          if (previousRequest) {
            if (previousRequest.fingerprint !== fingerprint) {
              throw new ApiError(
                'VALIDATION',
                '이미 처리된 주문 키를 다른 요청 내용에 사용할 수 없습니다.',
              );
            }
            return structuredClone(previousRequest.receipt);
          }
          const inFlightRequest = inFlightOrdersByIdempotencyKey.get(scopedKey);
          if (inFlightRequest) {
            if (inFlightRequest.fingerprint !== fingerprint) {
              throw new ApiError(
                'VALIDATION',
                '처리 중인 주문 키를 다른 요청 내용에 사용할 수 없습니다.',
              );
            }
            return structuredClone(await inFlightRequest.promise);
          }
        }
        const createOrder = async (): Promise<OrderReceipt> => {
          await wait(config.mockLatencyMs, options?.signal);
          grantAutomaticCoupons(buyerMember.id);
          if (config.mockScenario === 'error') {
            throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
          }
          if (input.lines.length === 0) {
            throw new ApiError('VALIDATION', '주문할 상품을 선택해 주세요.');
          }

          let productTotal = 0;
          const skuReservations = new Map<
            string,
            { product: AdminProduct; skuId: string; quantity: number }
          >();
          const orderLines: Order['lines'] = [];
          for (const orderLine of input.lines) {
            if (!Number.isInteger(orderLine.quantity) || orderLine.quantity < 1) {
              throw new ApiError('VALIDATION', '상품 수량을 확인해 주세요.');
            }
            const adminProduct = products.find((product) => product.id === orderLine.productId);
            const product = adminProduct ? toBuyerProduct(adminProduct) : undefined;
            if (
              !adminProduct ||
              !isBuyerVisibleProduct(adminProduct) ||
              !product ||
              !canBuyNow(product)
            ) {
              throw new ApiError('VALIDATION', '주문할 수 없는 상품이 포함되어 있습니다.');
            }
            const option = resolveCartOption(product, orderLine.optionId);
            if (!option.isAvailable) {
              throw new ApiError('VALIDATION', '상품 옵션을 다시 선택해 주세요.');
            }
            if (option.sku) {
              const adminSku = adminProduct.skus?.find(
                (candidate) => candidate.id === option.sku?.id,
              );
              if (!adminSku || adminSku.salesStatus !== 'active' || adminSku.stockCount < 1) {
                throw new ApiError('VALIDATION', '선택한 상품 옵션을 구매할 수 없습니다.');
              }
              const reservationKey = `${adminProduct.id}:${option.sku.id}`;
              const previous = skuReservations.get(reservationKey);
              const reservedQuantity = (previous?.quantity ?? 0) + orderLine.quantity;
              if (reservedQuantity > adminSku.stockCount) {
                throw new ApiError('VALIDATION', '선택한 상품 옵션의 재고가 부족합니다.');
              }
              skuReservations.set(reservationKey, {
                product: adminProduct,
                skuId: option.sku.id,
                quantity: reservedQuantity,
              });
            }
            productTotal += ((product.price ?? 0) + option.priceDelta) * orderLine.quantity;
            orderLines.push({
              productId: product.id,
              productName: product.name,
              unitPrice: (product.price ?? 0) + option.priceDelta,
              quantity: orderLine.quantity,
              optionId: orderLine.optionId,
              skuId: option.sku?.id ?? null,
              optionLabel: option.optionLabel,
            });
          }

          const ownedCoupon = input.couponId
            ? ownedCoupons.find(
                (candidate) =>
                  candidate.id === input.couponId && candidate.memberId === buyerMember.id,
              )
            : undefined;
          const couponDefinition = ownedCoupon?.adminCouponId
            ? adminCoupons.find((candidate) => candidate.id === ownedCoupon.adminCouponId)
            : undefined;
          const today = new Date().toISOString().slice(0, 10);
          const couponEligible = Boolean(
            ownedCoupon &&
            !ownedCoupon.isUsed &&
            couponDefinition &&
            couponDefinition.status === 'active' &&
            couponDefinition.target === 'all' &&
            couponDefinition.productScope === 'all' &&
            couponDefinition.startsAt <= today &&
            couponDefinition.endsAt >= today &&
            productTotal >= couponDefinition.minimumOrderAmount,
          );
          if (input.couponId && !couponEligible) {
            throw new ApiError('VALIDATION', '사용할 수 없는 쿠폰입니다.');
          }
          const rawDiscount = couponDefinition
            ? couponDefinition.benefitType === 'amount'
              ? couponDefinition.benefitValue
              : Math.floor((productTotal * couponDefinition.benefitValue) / 100)
            : 0;
          const discountTotal = Math.min(
            productTotal,
            rawDiscount,
            couponDefinition?.maxDiscountAmount ?? productTotal,
          );
          const remainingAfterDiscount = productTotal - discountTotal;
          if (!Number.isInteger(input.pointsToUse) || input.pointsToUse < 0) {
            throw new ApiError('VALIDATION', '사용할 적립금을 확인해 주세요.');
          }
          const pointsUsed = Math.min(input.pointsToUse, remainingAfterDiscount);
          if (input.pointsToUse > remainingAfterDiscount)
            throw new ApiError('VALIDATION', '주문 금액보다 많은 적립금을 사용할 수 없습니다.');
          if (pointsUsed > buyerMember.pointBalance)
            throw new ApiError('VALIDATION', '보유 적립금이 부족합니다.');
          const shippingBasis =
            adminSettings.freeShippingScope === 'all' ? productTotal : remainingAfterDiscount;
          const isFreeShipping =
            adminSettings.freeShippingEnabled &&
            shippingBasis >= adminSettings.freeShippingThreshold;
          const shippingFee =
            productTotal === 0 || isFreeShipping || adminSettings.baseFeeMode === 'included'
              ? 0
              : adminSettings.baseShippingFee;
          const paymentTotal = Math.max(0, remainingAfterDiscount - pointsUsed + shippingFee);
          const now = new Date();
          const timestamp = now
            .toISOString()
            .replace(/[-:TZ.]/g, '')
            .slice(0, 14);
          const orderNumber = `${timestamp}-${String(++orderSequence).padStart(4, '0')}`;
          const newOrder: AdminOrder = {
            id: `ord-${orderNumber}`,
            orderNumber,
            orderedAt: now.toISOString(),
            status: 'paymentPending',
            memberId: buyerMember.id,
            lines: orderLines,
            productTotal,
            shippingFee,
            discountTotal,
            pointUsed: pointsUsed,
            paymentTotal,
            shippingAddress: structuredClone(input.shippingAddress),
            trackingCarrier: null,
            trackingNumber: null,
            adminMemo: '',
            statusHistory: [
              { status: 'paymentPending', occurredAt: now.toISOString(), note: '주문 접수' },
            ],
            usedCouponId: ownedCoupon && couponEligible ? ownedCoupon.id : null,
          };
          for (const reservation of skuReservations.values()) {
            const sku = reservation.product.skus?.find((item) => item.id === reservation.skuId);
            if (sku) sku.stockCount -= reservation.quantity;
            if (
              reservation.product.skus?.length &&
              reservation.product.skus.every(
                (item) => item.salesStatus !== 'active' || item.stockCount < 1,
              )
            ) {
              reservation.product.stockStatus = 'soldOut';
            }
          }
          if (ownedCoupon && couponEligible && couponDefinition) {
            ownedCoupon.isUsed = true;
            couponDefinition.usedCount += 1;
          }
          if (pointsUsed > 0) {
            const point: AdminPoint = {
              id: `pt-order-${pointSequence++}`,
              memberId: buyerMember.id,
              description: '주문 적립금 사용',
              reason: '주문 적립금 사용',
              amount: -pointsUsed,
              occurredAt: now.toISOString(),
              expiresAt: null,
            };
            adminPoints.unshift(point);
            buyerMember.pointBalance -= pointsUsed;
          }
          orders.unshift(newOrder);
          const receipt = {
            orderNumber,
            productTotal,
            discountTotal,
            shippingFee,
            pointsUsed,
            paymentTotal,
          };
          return structuredClone(receipt);
        };
        if (!scopedKey) return createOrder();
        const operation = createOrder();
        inFlightOrdersByIdempotencyKey.set(scopedKey, { fingerprint, promise: operation });
        try {
          const receipt = await operation;
          orderReceiptsByIdempotencyKey.set(scopedKey, { fingerprint, receipt });
          return structuredClone(receipt);
        } finally {
          inFlightOrdersByIdempotencyKey.delete(scopedKey);
        }
      },
    },
    claims: {
      adminList: (options) => respondList(claims, options),
      async submit(input: ClaimSubmitInput, options) {
        await prepareMutation(options, '클레임');
        const member = await getCurrentMember();
        const order = orders.find(
          (item) => item.id === input.orderId && item.memberId === member.id,
        );
        if (!order) throw new ApiError('NOT_FOUND', '주문을 찾을 수 없습니다.');
        const eligibleStatus =
          input.type === 'cancel'
            ? ['paymentPending', 'paid', 'preparing'].includes(order.status)
            : ['shipping', 'delivered'].includes(order.status);
        if (!eligibleStatus)
          throw new ApiError('VALIDATION', '현재 주문 상태에서는 신청할 수 없습니다.');
        if (
          claims.some(
            (claim) =>
              claim.orderId === order.id && ['requested', 'processing'].includes(claim.status),
          )
        ) {
          throw new ApiError(
            'VALIDATION',
            '해당 주문에 처리 중인 취소·반품·교환 신청이 있습니다. 기존 신청 처리 후 다시 요청해 주세요.',
          );
        }
        if (!input.reason.trim() || !input.description.trim() || input.items.length === 0) {
          throw new ApiError('VALIDATION', '신청 사유와 상품 정보를 입력해 주세요.');
        }
        if (input.type !== 'cancel' && (!input.returnMethod || !input.returnAddress)) {
          throw new ApiError('VALIDATION', '회수 방법과 회수 주소를 선택해 주세요.');
        }
        if (
          input.attachments?.some(
            (attachment) =>
              !attachment.fileName.trim() ||
              !Number.isInteger(attachment.sizeBytes) ||
              attachment.sizeBytes < 0 ||
              attachment.sizeBytes > 6_000_000,
          )
        ) {
          throw new ApiError('VALIDATION', '첨부 파일 정보를 확인해 주세요.');
        }
        const orderQuantities = new Map<string, number>();
        for (const line of order.lines) {
          const lineKey = `${line.productId}:${line.skuId ?? ''}`;
          orderQuantities.set(lineKey, (orderQuantities.get(lineKey) ?? 0) + line.quantity);
        }
        const completedReturnQuantities = new Map<string, number>();
        if (input.type === 'return') {
          for (const previousClaim of claims) {
            if (
              previousClaim.orderId !== order.id ||
              previousClaim.type !== 'return' ||
              previousClaim.status !== 'completed'
            )
              continue;
            for (const previousItem of previousClaim.items ?? []) {
              const lineKey = `${previousItem.productId}:${previousItem.skuId ?? ''}`;
              completedReturnQuantities.set(
                lineKey,
                (completedReturnQuantities.get(lineKey) ?? 0) + previousItem.quantity,
              );
            }
          }
        }
        const requestedQuantities = new Map<string, number>();
        for (const item of input.items) {
          const lineKey = `${item.productId}:${item.skuId ?? ''}`;
          if (
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            !orderQuantities.has(lineKey)
          ) {
            throw new ApiError('VALIDATION', '신청 상품과 수량을 확인해 주세요.');
          }
          requestedQuantities.set(lineKey, (requestedQuantities.get(lineKey) ?? 0) + item.quantity);
        }
        if (
          [...requestedQuantities].some(([lineKey, quantity]) => {
            const orderedQuantity = orderQuantities.get(lineKey) ?? 0;
            const alreadyReturnedQuantity = completedReturnQuantities.get(lineKey) ?? 0;
            return (
              quantity > orderedQuantity - (input.type === 'return' ? alreadyReturnedQuantity : 0)
            );
          })
        ) {
          throw new ApiError('VALIDATION', '신청 수량이 주문 수량을 초과했습니다.');
        }
        const requestedAt = new Date().toISOString();
        const claim: AdminClaim = {
          id: `clm-web-${String(claimSequence++).padStart(4, '0')}`,
          orderId: order.id,
          type: input.type,
          status: 'requested',
          reason: input.reason.trim(),
          description: input.description.trim(),
          items: input.items.map((item) => ({
            ...item,
            optionLabel:
              order.lines.find(
                (line) =>
                  line.productId === item.productId &&
                  (line.skuId ?? null) === (item.skuId ?? null),
              )?.optionLabel ?? null,
          })),
          ...(input.type !== 'cancel' && input.returnMethod && input.returnAddress
            ? {
                returnMethod: input.returnMethod,
                returnAddress: structuredClone(input.returnAddress),
              }
            : {}),
          ...(input.attachments?.length
            ? {
                attachments: input.attachments.map(({ fileName, mimeType, sizeBytes }) => ({
                  fileName,
                  mimeType,
                  sizeBytes,
                })),
              }
            : {}),
          requestedAt,
          adminMemo: '',
          statusHistory: [
            { status: 'requested', occurredAt: requestedAt, note: '구매자 신청 접수' },
          ],
        };
        claims.unshift(claim);
        const { adminMemo: _adminMemo, statusHistory: _statusHistory, ...buyerClaim } = claim;
        return structuredClone(buyerClaim);
      },
      async updateAdmin(claimId, update, options) {
        await prepareMutation(options, '클레임');
        const claim = claims.find((item) => item.id === claimId);
        if (!claim) throw new ApiError('NOT_FOUND', '클레임을 찾을 수 없습니다.');
        if (claim.type === 'cancel' && update.status === 'completed') {
          throw new ApiError('VALIDATION', '취소 완료는 주문 취소 전용 처리로 진행해 주세요.');
        }
        if (update.status && update.status !== claim.status) {
          claim.statusHistory.push({
            status: update.status,
            occurredAt: new Date().toISOString(),
            note: '관리자 상태 변경',
          });
          claim.status = update.status;
        }
        if (update.adminMemo !== undefined) claim.adminMemo = update.adminMemo.trim();
        return structuredClone(claim);
      },
      async completeOrderCancellation(orderId, claimId, reason, options) {
        await prepareMutation(options, '주문 취소');
        const order = orders.find((item) => item.id === orderId);
        const claim = claims.find((item) => item.id === claimId);
        if (!order || !claim || claim.orderId !== orderId || claim.type !== 'cancel') {
          throw new ApiError('NOT_FOUND', '주문 또는 취소 요청을 찾을 수 없습니다.');
        }
        if (!reason.trim()) throw new ApiError('VALIDATION', '취소 사유를 입력해 주세요.');
        if (order.status === 'canceled' && claim.status === 'completed') {
          return { order: structuredClone(order), claim: structuredClone(claim) };
        }
        if (
          claim.status !== 'requested' ||
          !['paymentPending', 'paid', 'preparing'].includes(order.status)
        ) {
          throw new ApiError(
            'VALIDATION',
            '접수된 취소 요청과 취소 가능한 주문만 처리할 수 있습니다.',
          );
        }
        const buyerMember = members.find((member) => member.id === order.memberId);
        if (!buyerMember) throw new ApiError('NOT_FOUND', '주문 회원을 찾을 수 없습니다.');
        const skuRestorations = new Map<
          string,
          { product: AdminProduct; skuId: string; quantity: number }
        >();
        for (const line of order.lines) {
          if (!line.skuId) continue;
          const product = products.find((candidate) => candidate.id === line.productId);
          const sku = product?.skus?.find((candidate) => candidate.id === line.skuId);
          if (!product || !sku) {
            throw new ApiError(
              'VALIDATION',
              '주문 당시 SKU를 찾을 수 없어 취소를 완료할 수 없습니다. 상품 옵션을 복구한 뒤 다시 시도해 주세요.',
            );
          }
          const key = `${line.productId}:${line.skuId}`;
          const previous = skuRestorations.get(key);
          skuRestorations.set(key, {
            product,
            skuId: line.skuId,
            quantity: (previous?.quantity ?? 0) + line.quantity,
          });
        }
        const usedCoupon = order.usedCouponId
          ? ownedCoupons.find(
              (coupon) => coupon.id === order.usedCouponId && coupon.memberId === order.memberId,
            )
          : undefined;
        const usedCouponDefinition = usedCoupon?.adminCouponId
          ? adminCoupons.find((coupon) => coupon.id === usedCoupon.adminCouponId)
          : undefined;
        if (order.usedCouponId && (!usedCoupon || !usedCouponDefinition)) {
          throw new ApiError('VALIDATION', '주문에 사용한 쿠폰을 찾아 취소할 수 없습니다.');
        }
        const occurredAt = new Date().toISOString();
        for (const restoration of skuRestorations.values()) {
          const sku = restoration.product.skus?.find((item) => item.id === restoration.skuId);
          if (sku) sku.stockCount += restoration.quantity;
          if (
            restoration.product.skus?.some(
              (item) => item.salesStatus === 'active' && item.stockCount > 0,
            )
          ) {
            restoration.product.stockStatus = 'inStock';
          }
        }
        if (order.pointUsed > 0) {
          const point: AdminPoint = {
            id: `pt-cancel-${pointSequence++}`,
            memberId: buyerMember.id,
            description: '주문 취소 적립금 복원',
            reason: '주문 취소 적립금 복원',
            amount: order.pointUsed,
            occurredAt,
            expiresAt: null,
          };
          adminPoints.unshift(point);
          buyerMember.pointBalance += order.pointUsed;
        }
        if (usedCoupon && usedCouponDefinition && usedCoupon.isUsed) {
          usedCoupon.isUsed = false;
          usedCouponDefinition.usedCount = Math.max(0, usedCouponDefinition.usedCount - 1);
        }
        order.status = 'canceled';
        order.adminMemo = reason.trim();
        order.statusHistory.push({ status: 'canceled', occurredAt, note: '취소 요청 처리' });
        claim.status = 'completed';
        claim.adminMemo = reason.trim();
        claim.statusHistory.push({
          status: 'completed',
          occurredAt,
          note: '주문 취소와 함께 처리',
        });
        return { order: structuredClone(order), claim: structuredClone(claim) };
      },
      async listByMember(memberId, options) {
        await assertCurrentMember(memberId);
        const memberOrderIds = new Set(
          orders.filter((order) => order.memberId === memberId).map((order) => order.id),
        );
        return respondList(
          claims
            .filter((claim) => memberOrderIds.has(claim.orderId))
            .map(({ adminMemo: _adminMemo, statusHistory: _statusHistory, ...claim }) => claim),
          options,
        );
      },
    },
    coupons: {
      async list(options) {
        const member = await getCurrentMember();
        return respondList(getCheckoutBuyerCoupons(member.id), options);
      },
      async historyList(options) {
        const member = await getCurrentMember();
        return respondList(getOwnedBuyerCoupons(member.id), options);
      },
      async availableList(options) {
        const member = await getCurrentMember();
        return respondList(getAvailableCouponOffers(member.id), options);
      },
      async acquire(couponId, options) {
        await prepareMutation(options, '쿠폰');
        const member = await getCurrentMember();
        const coupon = adminCoupons.find((item) => item.id === couponId);
        if (!coupon || coupon.issueMethod !== 'download')
          throw new ApiError('NOT_FOUND', '다운로드할 쿠폰을 찾을 수 없습니다.');
        const issuedCoupon = issueOwnedCoupon(coupon, member.id);
        return structuredClone(toBuyerCoupon(issuedCoupon, coupon));
      },
      async redeemCode(code, options) {
        await prepareMutation(options, '쿠폰');
        const member = await getCurrentMember();
        const coupon = adminCoupons.find(
          (item) =>
            item.issueMethod === 'code' &&
            item.code.trim().toLocaleLowerCase() === code.trim().toLocaleLowerCase(),
        );
        if (!coupon) throw new ApiError('NOT_FOUND', '등록할 수 있는 쿠폰 코드를 찾지 못했습니다.');
        if (findOwnedCoupon(member.id, coupon.id))
          throw new ApiError('VALIDATION', '이미 등록한 쿠폰 코드입니다.');
        return structuredClone(toBuyerCoupon(issueOwnedCoupon(coupon, member.id), coupon));
      },
      adminList: (options) => respondList(adminCoupons, options),
      async saveAdmin(input: AdminCouponInput, options) {
        await prepareMutation(options, '운영 쿠폰');
        if (!input.name.trim() || !input.code.trim())
          throw new ApiError('VALIDATION', '쿠폰명과 코드를 입력해 주세요.');
        if (!Number.isFinite(input.benefitValue) || input.benefitValue <= 0)
          throw new ApiError('VALIDATION', '쿠폰 혜택 값을 확인해 주세요.');
        if (input.benefitType === 'rate' && input.benefitValue > 100)
          throw new ApiError('VALIDATION', '할인율은 100% 이하여야 합니다.');
        if (!Number.isFinite(input.minimumOrderAmount) || input.minimumOrderAmount < 0)
          throw new ApiError('VALIDATION', '최소 주문 금액을 확인해 주세요.');
        if (
          adminCoupons.some(
            (coupon) =>
              coupon.code.toLocaleLowerCase() === input.code.trim().toLocaleLowerCase() &&
              coupon.id !== input.id,
          )
        ) {
          throw new ApiError('VALIDATION', '이미 사용 중인 쿠폰 코드입니다.');
        }
        let coupon: AdminCoupon;
        if (input.id) {
          const index = adminCoupons.findIndex((item) => item.id === input.id);
          if (index < 0) throw new ApiError('NOT_FOUND', '운영 쿠폰을 찾을 수 없습니다.');
          const existingCoupon = adminCoupons[index];
          if (!existingCoupon) throw new ApiError('NOT_FOUND', '운영 쿠폰을 찾을 수 없습니다.');
          coupon = { ...existingCoupon, ...input, id: input.id };
          adminCoupons[index] = coupon;
        } else {
          coupon = {
            ...input,
            id: `coupon-admin-${adminCouponSequence++}`,
            issuedCount: 0,
            usedCount: 0,
          };
          adminCoupons.unshift(coupon);
        }
        return structuredClone(coupon);
      },
      async deleteAdmin(couponId, options) {
        await prepareMutation(options, '운영 쿠폰');
        const index = adminCoupons.findIndex((coupon) => coupon.id === couponId);
        if (index < 0) throw new ApiError('NOT_FOUND', '운영 쿠폰을 찾을 수 없습니다.');
        const coupon = adminCoupons[index];
        if (!coupon) throw new ApiError('NOT_FOUND', '운영 쿠폰을 찾을 수 없습니다.');
        if (coupon.issuedCount > 0 || coupon.usedCount > 0)
          throw new ApiError(
            'VALIDATION',
            '발급 또는 사용 이력이 있는 쿠폰은 삭제할 수 없습니다. 상태를 중지해 주세요.',
          );
        adminCoupons.splice(index, 1);
      },
    },
    points: {
      async list(options) {
        const member = await getCurrentMember();
        return respondList(
          adminPoints
            .filter((point) => point.memberId === member.id)
            .map(({ memberId: _memberId, reason: _reason, ...point }) => point),
          options,
        );
      },
      adminList: (options) => respondList(adminPoints, options),
      async adjustAdmin(input, options) {
        await prepareMutation(options, '적립금');
        const member = members.find((item) => item.id === input.memberId);
        if (!member) throw new ApiError('NOT_FOUND', '회원을 찾을 수 없습니다.');
        if (!Number.isInteger(input.amount) || input.amount === 0 || !input.reason.trim())
          throw new ApiError('VALIDATION', '0이 아닌 정수 금액과 조정 사유를 입력해 주세요.');
        if (member.pointBalance + input.amount < 0)
          throw new ApiError('VALIDATION', '회원의 현재 적립금보다 많이 차감할 수 없습니다.');
        const point: AdminPoint = {
          id: `pt-admin-${adminPoints.length + 1}`,
          memberId: input.memberId,
          description: input.reason.trim(),
          reason: input.reason.trim(),
          amount: input.amount,
          occurredAt: new Date().toISOString(),
          expiresAt: input.expiresAt,
        };
        adminPoints.unshift(point);
        member.pointBalance += input.amount;
        return structuredClone(point);
      },
    },
    addresses: {
      async list(options) {
        const member = await getCurrentMember();
        const ownedAddresses = mockAddresses
          .filter((address) => address.memberId === member.id)
          .map(({ memberId: _memberId, ...address }) => address);
        return respondList(ownedAddresses, options);
      },
    },
    quotes: {
      async submit(input: QuoteSubmitInput, options) {
        await prepareMutation(options, '견적 문의');
        const member = await getCurrentMember();
        if (
          !input.title.trim() ||
          !input.companyName.trim() ||
          !input.contactName.trim() ||
          !input.inquiryBody.trim()
        ) {
          throw new ApiError('VALIDATION', '견적 문의에 필요한 정보를 입력해 주세요.');
        }
        if (
          !input.requestedItems.length ||
          input.requestedItems.some(
            (line) => !line.name.trim() || !Number.isInteger(line.quantity) || line.quantity < 1,
          )
        ) {
          throw new ApiError('VALIDATION', '문의 상품과 수량을 확인해 주세요.');
        }
        if (
          input.attachments.some(
            (attachment) =>
              !attachment.fileName.trim() ||
              !Number.isInteger(attachment.sizeBytes) ||
              attachment.sizeBytes < 0 ||
              attachment.sizeBytes > 6_000_000,
          )
        ) {
          throw new ApiError(
            'VALIDATION',
            '첨부 파일 정보를 확인해 주세요. 파일은 6MB 이하만 가능합니다.',
          );
        }
        const quote: AdminQuote = {
          id: `qt-web-${String(quoteSequence++).padStart(4, '0')}`,
          title: input.title.trim(),
          companyName: input.companyName.trim(),
          contactName: input.contactName.trim(),
          status: 'received',
          requestedAt: new Date().toISOString(),
          memberId: member.id,
          inquiryBody: input.inquiryBody.trim(),
          requestedItems: structuredClone(input.requestedItems),
          attachments: input.attachments.map(({ id, fileName, mimeType, sizeBytes }) => ({
            id,
            fileName,
            mimeType,
            sizeBytes,
          })),
          internalMemo: '',
          publicMessage: null,
          quoteAmount: null,
          expiresAt: null,
        };
        quotes.unshift(quote);
        return structuredClone(toBuyerQuote(quote));
      },
      adminList: (options) => respondList(quotes, options),
      async updateAdmin(quoteId, update, options) {
        await prepareMutation(options, '견적 문의');
        const quote = quotes.find((item) => item.id === quoteId);
        if (!quote) throw new ApiError('NOT_FOUND', '견적 문의를 찾을 수 없습니다.');
        if (update.status && update.status !== quote.status) quote.status = update.status;
        if (update.internalMemo !== undefined) quote.internalMemo = update.internalMemo.trim();
        if (update.publicMessage !== undefined)
          quote.publicMessage = update.publicMessage?.trim() || null;
        if (update.quoteAmount !== undefined) {
          if (
            update.quoteAmount !== null &&
            (!Number.isInteger(update.quoteAmount) || update.quoteAmount < 0)
          ) {
            throw new ApiError('VALIDATION', '견적 금액을 확인해 주세요.');
          }
          quote.quoteAmount = update.quoteAmount;
        }
        if (update.expiresAt !== undefined) quote.expiresAt = update.expiresAt;
        if (update.attachments !== undefined) {
          if (
            update.attachments.some(
              (attachment) =>
                !attachment.fileName.trim() ||
                !Number.isInteger(attachment.sizeBytes) ||
                attachment.sizeBytes < 0 ||
                attachment.sizeBytes > 6_000_000,
            )
          ) {
            throw new ApiError(
              'VALIDATION',
              '첨부 파일 정보를 확인해 주세요. 파일은 6MB 이하만 가능합니다.',
            );
          }
          quote.attachments = update.attachments.map(({ id, fileName, mimeType, sizeBytes }) => ({
            id,
            fileName,
            mimeType,
            sizeBytes,
          }));
        }
        return structuredClone(quote);
      },
      async listByMember(memberId, options) {
        await assertCurrentMember(memberId);
        return respondList(
          quotes.filter((quote) => quote.memberId === memberId).map(toBuyerQuote),
          options,
        );
      },
    },
    notices: {
      list: (options) =>
        respondList(
          adminNotices
            .filter((notice) => notice.isVisible)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(({ isVisible: _isVisible, sortOrder: _sortOrder, ...notice }) => notice),
          options,
        ),
      adminList: (options) =>
        respondList(
          [...adminNotices].sort((a, b) => a.sortOrder - b.sortOrder),
          options,
        ),
      async saveAdmin(input: AdminNoticeInput, options) {
        await prepareMutation(options, '공지');
        if (!input.title.trim() || !input.body.trim())
          throw new ApiError('VALIDATION', '공지 제목과 내용을 입력해 주세요.');
        const item: AdminNotice = {
          ...structuredClone(input),
          id: input.id ?? `ntc-admin-${adminNotices.length + 1}`,
        };
        const index = adminNotices.findIndex((notice) => notice.id === item.id);
        if (index < 0) adminNotices.unshift(item);
        else adminNotices[index] = item;
        return structuredClone(item);
      },
      async deleteAdmin(noticeId, options) {
        await prepareMutation(options, '공지');
        const index = adminNotices.findIndex((notice) => notice.id === noticeId);
        if (index < 0) throw new ApiError('NOT_FOUND', '공지를 찾을 수 없습니다.');
        adminNotices.splice(index, 1);
      },
    },
    events: {
      list: (options) =>
        respondList(
          events
            .filter((event) => event.isVisible)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map(toBuyerEvent),
          options,
        ),
      async getById(eventId, options) {
        const foundEvent = events.find(
          (shopEvent) => shopEvent.id === eventId && shopEvent.isVisible,
        );
        return respondOne(foundEvent ? toBuyerEvent(foundEvent) : undefined, '이벤트', options);
      },
      adminList: (options) =>
        respondList(
          [...events].sort((left, right) => left.sortOrder - right.sortOrder),
          options,
        ),
      async saveAdmin(input, options) {
        await prepareMutation(options, '이벤트');
        if (!input.title.trim()) throw new ApiError('VALIDATION', '이벤트명을 입력해 주세요.');
        const startDate = Date.parse(input.startAt);
        const endDate = Date.parse(input.endAt);
        if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || endDate < startDate) {
          throw new ApiError('VALIDATION', '이벤트 시작일과 종료일을 확인해 주세요.');
        }
        if (!input.title.trim() || !input.heroTitle.some((line) => line.trim())) {
          throw new ApiError('VALIDATION', '이벤트 제목과 상세 제목을 입력해 주세요.');
        }
        const nextEvent: AdminShopEvent = {
          ...structuredClone(input),
          id: input.id ?? `event-admin-${String(eventSequence++).padStart(4, '0')}`,
        };
        const existingIndex = events.findIndex((event) => event.id === nextEvent.id);
        if (existingIndex < 0) events.push(nextEvent);
        else events[existingIndex] = nextEvent;
        return structuredClone(nextEvent);
      },
      async deleteAdmin(eventId, options) {
        await prepareMutation(options, '이벤트');
        const index = events.findIndex((event) => event.id === eventId);
        if (index < 0) throw new ApiError('NOT_FOUND', '이벤트를 찾을 수 없습니다.');
        events.splice(index, 1);
      },
    },
    faqs: {
      list: (options) =>
        respondList(
          adminFaqs
            .filter((faq) => faq.isVisible)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(({ isVisible: _isVisible, sortOrder: _sortOrder, ...faq }) => faq),
          options,
        ),
      adminList: (options) =>
        respondList(
          [...adminFaqs].sort((a, b) => a.sortOrder - b.sortOrder),
          options,
        ),
      async saveAdmin(input: AdminFaqInput, options) {
        await prepareMutation(options, 'FAQ');
        if (!input.category.trim() || !input.question.trim() || !input.answer.trim())
          throw new ApiError('VALIDATION', 'FAQ 분류, 질문, 답변을 입력해 주세요.');
        const item: AdminFaq = {
          ...structuredClone(input),
          id: input.id ?? `faq-admin-${adminFaqs.length + 1}`,
        };
        const index = adminFaqs.findIndex((faq) => faq.id === item.id);
        if (index < 0) adminFaqs.unshift(item);
        else adminFaqs[index] = item;
        return structuredClone(item);
      },
      async deleteAdmin(faqId, options) {
        await prepareMutation(options, 'FAQ');
        const index = adminFaqs.findIndex((faq) => faq.id === faqId);
        if (index < 0) throw new ApiError('NOT_FOUND', 'FAQ를 찾을 수 없습니다.');
        adminFaqs.splice(index, 1);
      },
    },
    inquiries: {
      async listByMember(memberId, options) {
        await assertCurrentMember(memberId);
        return respondList(
          inquiries
            .filter((inquiry) => inquiry.memberId === memberId)
            .map(({ adminMemo: _adminMemo, statusHistory: _statusHistory, ...inquiry }) => inquiry),
          options,
        );
      },
      adminList: (options) => respondList(inquiries, options),
      async updateAdmin(inquiryId, update: AdminInquiryUpdate, options) {
        await prepareMutation(options, '1:1 문의');
        const inquiry = inquiries.find((item) => item.id === inquiryId);
        if (!inquiry) throw new ApiError('NOT_FOUND', '1:1 문의를 찾을 수 없습니다.');
        if (update.answer && update.answer.length > 5000)
          throw new ApiError('VALIDATION', '공개 답변은 5,000자 이내로 입력해 주세요.');
        if (update.status === 'answered' && !(update.answer ?? inquiry.answer)?.trim())
          throw new ApiError('VALIDATION', '답변을 입력한 뒤 완료 처리해 주세요.');
        const previousStatus = inquiry.status;
        Object.assign(inquiry, structuredClone(update));
        if (update.status && update.status !== previousStatus)
          inquiry.statusHistory.push({
            status: update.status,
            occurredAt: new Date().toISOString(),
            note: update.status === 'answered' ? '답변 등록' : '답변 상태 변경',
          });
        return structuredClone(inquiry);
      },
    },
    members: {
      async getCurrent(options) {
        return respondOne(await getCurrentMember(), '구매자 회원', options);
      },
      async list(options) {
        return respondList([await getCurrentMember()], options);
      },
      adminList: (options) => respondList(members, options),
    },
  };
}
