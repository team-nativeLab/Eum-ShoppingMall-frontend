import { collectCategoryIdsWithDescendants } from './category-tree';
import { resolveCartOption } from './cart';
import { assertMockAllowed, type ApiConfig } from './config';
import { ApiError } from './errors';
import { mockAddresses } from './mock/addresses';
import { mockCoupons, mockPoints } from './mock/benefits';
import { mockBrands, type MockBrandRecord } from './mock/brands';
import { mockCategories } from './mock/categories';
import { mockCheckoutOptions } from './mock/checkout';
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
import { mockFaqs, mockInquiries, mockNotices, mockQuotes } from './mock/support';
import type { ProductFacetParams, RequestOptions, ShopApi } from './shop-api';
import type {
  AdminProduct,
  Brand,
  BrandSummary,
  CheckoutOptions,
  CreateOrderInput,
  FacetCount,
  HomeContent,
  OrderReceipt,
  PagedResult,
  Product,
  ProductFacets,
  ProductReview,
} from './types';
import { canBuyNow } from './price';

const DEFAULT_PAGE_SIZE = 20;
/** 관련·추천 상품 기본 개수 */
const DEFAULT_COLLECTION_LIMIT = 10;

/** 관리자 목 원본에서 실제 가격을 구매자 응답으로 복사하지 않는 변환 함수 */
function toBuyerProduct(product: AdminProduct): Product {
  return {
    ...product,
    price: product.priceVisible ? product.price : null,
    listPrice: product.priceVisible ? product.listPrice : null,
  };
}

/** 상위 카테고리를 조회할 때 그 하위 카테고리까지 포함합니다. */
function getCategoryIds(categoryId: string | undefined): Set<string> | null {
  if (categoryId === undefined) return null;
  return collectCategoryIdsWithDescendants(mockCategories, categoryId);
}

/** 검색어가 상품명·브랜드에 들어 있는지 확인하는 함수(대소문자 무시) */
function matchesKeyword(product: AdminProduct, normalizedKeyword: string): boolean {
  return (
    normalizedKeyword === '' ||
    `${product.name} ${product.brand}`.toLowerCase().includes(normalizedKeyword)
  );
}

/** 카테고리 ID → 최상위 카테고리 ID 표. 검색 결과의 카테고리별 개수를 셀 때 씁니다. */
function buildTopLevelCategoryMap(): Map<string, string> {
  const parentIdByCategoryId = new Map(
    mockCategories.map((category) => [category.id, category.parentId]),
  );
  const topLevelIdByCategoryId = new Map<string, string>();
  for (const category of mockCategories) {
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
function buildFacets(params: ProductFacetParams): ProductFacets {
  const normalizedKeyword = params.keyword?.trim().toLowerCase() ?? '';
  const keywordProducts = mockProducts.filter((product) =>
    matchesKeyword(product, normalizedKeyword),
  );
  const categoryIds = getCategoryIds(params.categoryId);
  const scopedProducts = keywordProducts.filter(
    (product) => categoryIds === null || categoryIds.has(product.categoryId),
  );
  const topLevelIdByCategoryId = buildTopLevelCategoryMap();
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
function selectRelatedProducts(productId: string, limit: number): AdminProduct[] {
  const baseProduct = mockProducts.find((product) => product.id === productId);
  if (!baseProduct) return [];
  const topLevelIdByCategoryId = buildTopLevelCategoryMap();
  const baseTopLevelId = topLevelIdByCategoryId.get(baseProduct.categoryId);
  const otherProducts = mockProducts.filter((product) => product.id !== productId);
  const sameCategoryProducts = otherProducts.filter(
    (product) => topLevelIdByCategoryId.get(product.categoryId) === baseTopLevelId,
  );
  const fillerProducts = otherProducts.filter(
    (product) => product.isFeatured && !sameCategoryProducts.includes(product),
  );
  return [...sameCategoryProducts, ...fillerProducts].slice(0, limit);
}

/** 추천 상품 목 규칙: 베스트(isFeatured) 상품을 먼저, 모자라면 최신 상품으로 채웁니다. */
function selectRecommendedProducts(limit: number): AdminProduct[] {
  const featuredProducts = mockProducts.filter((product) => product.isFeatured);
  const newestProducts = mockProducts
    .filter((product) => !product.isFeatured)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return [...featuredProducts, ...newestProducts].slice(0, limit);
}

/** 개수 조건을 1 이상의 정수로 맞추는 함수 */
function normalizeLimit(limit: number | undefined): number {
  return Math.max(1, Math.floor(limit ?? DEFAULT_COLLECTION_LIMIT));
}

/** 브랜드의 상품 수. 기존 상품 목록의 브랜드 이름 필터와 같은 기준으로 셉니다. */
function countBrandProducts(brandName: string): number {
  return mockProducts.filter((product) => product.brand === brandName).length;
}

/** 관리자 설정 필드를 제외하고 상품 수를 붙여 구매자 상세 응답으로 바꿉니다. */
function toBuyerBrand(brandRecord: MockBrandRecord): Brand {
  const { isVisible: _isVisible, isFeatured: _isFeatured, ...brandFields } = brandRecord;
  return { ...brandFields, productCount: countBrandProducts(brandRecord.name) };
}

/** 구매자 목록 항목으로 줄입니다. */
function toBrandSummary(brandRecord: MockBrandRecord): BrandSummary {
  return {
    id: brandRecord.id,
    name: brandRecord.name,
    englishName: brandRecord.englishName,
    logoUrl: brandRecord.logoUrl,
    tagline: brandRecord.tagline,
    productCount: countBrandProducts(brandRecord.name),
  };
}

/** 구매자에게 노출하는 브랜드만 반환합니다. */
function getVisibleBrands(): MockBrandRecord[] {
  return mockBrands.filter((brandRecord) => brandRecord.isVisible);
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
export function createMockApi(config: ApiConfig): ShopApi {
  assertMockAllowed(config);
  let orderSequence = 0;

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
        const categoryIds = getCategoryIds(params.categoryId);
        const brandFilters = new Set(params.brand ?? []);
        const certificationFilters = new Set(params.certification ?? []);
        const filteredProducts = mockProducts.filter((product) => {
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
            mockProducts.find((product) => product.id === productId),
            '상품',
            options,
          ),
        );
      },
      async suggest(keyword, options) {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (normalizedKeyword === '') return [];
        const matches = mockProducts
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
        return buildFacets(params);
      },
      async listRelated(productId, params = {}, options): Promise<Product[]> {
        const relatedProducts = await respondList(
          selectRelatedProducts(productId, normalizeLimit(params.limit)),
          options,
        );
        return relatedProducts.map(toBuyerProduct);
      },
      async listRecommended(params = {}, options): Promise<Product[]> {
        const recommendedProducts = await respondList(
          selectRecommendedProducts(normalizeLimit(params.limit)),
          options,
        );
        return recommendedProducts.map(toBuyerProduct);
      },
      async listReviews(productId, params = {}, options): Promise<PagedResult<ProductReview>> {
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
        const productReviews = await respondList(
          mockReviews
            .filter((review) => review.productId === productId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
          options,
        );
        return {
          items: productReviews.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          totalCount: productReviews.length,
        };
      },
    },
    brands: {
      list: (options) => respondList(getVisibleBrands().map(toBrandSummary), options),
      async getById(brandId, options): Promise<Brand> {
        const brandRecord = await respondOne(
          getVisibleBrands().find((visibleBrand) => visibleBrand.id === brandId),
          '브랜드',
          options,
        );
        return toBuyerBrand(brandRecord);
      },
      async getFeatured(options): Promise<Brand | null> {
        await wait(config.mockLatencyMs, options?.signal);
        if (config.mockScenario === 'error') {
          throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
        }
        if (config.mockScenario === 'empty') return null;
        const featuredBrand = getVisibleBrands().find((visibleBrand) => visibleBrand.isFeatured);
        return featuredBrand ? structuredClone(toBuyerBrand(featuredBrand)) : null;
      },
    },
    search: {
      recommendedKeywords: (options) => respondList(mockRecommendedKeywords, options),
    },
    checkout: {
      async getOptions(options): Promise<CheckoutOptions> {
        return respondOne(mockCheckoutOptions, '주문서 선택지', options);
      },
    },
    categories: { list: (options) => respondList(mockCategories, options) },
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
          heroSlides: mockHeroSlides,
          promoBanners: mockPromoBanners,
          serviceBenefits: mockServiceBenefits,
          featuredProducts: mockProducts
            .filter((product) => product.isFeatured)
            .map(toBuyerProduct),
          ctaBand: mockHomeCtaBand,
        });
      },
    },
    company: {
      getInfo: (options) => respondOne(mockCompanyInfo, '사업자 정보', options),
    },
    orders: {
      listByMember: (memberId, options) =>
        respondList(
          mockOrders.filter((order) => order.memberId === memberId),
          options,
        ),
      getById: (orderId, options) =>
        respondOne(
          mockOrders.find((order) => order.id === orderId),
          '주문',
          options,
        ),
      async create(input: CreateOrderInput, options): Promise<OrderReceipt> {
        await wait(config.mockLatencyMs, options?.signal);
        if (config.mockScenario === 'error') {
          throw new ApiError('NETWORK', '목 API 오류 시나리오입니다.');
        }
        if (input.lines.length === 0) {
          throw new ApiError('VALIDATION', '주문할 상품을 선택해 주세요.');
        }

        let productTotal = 0;
        for (const orderLine of input.lines) {
          if (!Number.isInteger(orderLine.quantity) || orderLine.quantity < 1) {
            throw new ApiError('VALIDATION', '상품 수량을 확인해 주세요.');
          }
          const adminProduct = mockProducts.find((product) => product.id === orderLine.productId);
          const product = adminProduct ? toBuyerProduct(adminProduct) : undefined;
          if (!product || !canBuyNow(product)) {
            throw new ApiError('VALIDATION', '주문할 수 없는 상품이 포함되어 있습니다.');
          }
          const option = resolveCartOption(product, orderLine.optionId);
          if (!option.isAvailable) {
            throw new ApiError('VALIDATION', '상품 옵션을 다시 선택해 주세요.');
          }
          productTotal += ((product.price ?? 0) + option.priceDelta) * orderLine.quantity;
        }

        const coupon = input.couponId
          ? mockCoupons.find((candidate) => candidate.id === input.couponId)
          : undefined;
        if (input.couponId && (!coupon || coupon.isUsed || productTotal < coupon.minOrderAmount)) {
          throw new ApiError('VALIDATION', '사용할 수 없는 쿠폰입니다.');
        }
        const rawDiscount = coupon
          ? coupon.discountType === 'amount'
            ? coupon.discountValue
            : Math.floor((productTotal * coupon.discountValue) / 100)
          : 0;
        const discountTotal = Math.min(productTotal, rawDiscount);
        const remainingAfterDiscount = productTotal - discountTotal;
        if (!Number.isInteger(input.pointsToUse) || input.pointsToUse < 0) {
          throw new ApiError('VALIDATION', '사용할 적립금을 확인해 주세요.');
        }
        const pointsUsed = Math.min(input.pointsToUse, remainingAfterDiscount);
        const shippingFee =
          productTotal === 0 || productTotal >= mockCheckoutOptions.freeShippingThreshold
            ? 0
            : mockCheckoutOptions.shippingFee;
        const paymentTotal = Math.max(0, remainingAfterDiscount - pointsUsed + shippingFee);
        const now = new Date();
        const timestamp = now
          .toISOString()
          .replace(/[-:TZ.]/g, '')
          .slice(0, 14);
        const orderNumber = `${timestamp}-${String(++orderSequence).padStart(4, '0')}`;
        return structuredClone({
          orderNumber,
          productTotal,
          discountTotal,
          shippingFee,
          pointsUsed,
          paymentTotal,
        });
      },
    },
    claims: {
      listByMember: (memberId, options) => {
        const memberOrderIds = new Set(
          mockOrders.filter((order) => order.memberId === memberId).map((order) => order.id),
        );
        return respondList(
          mockClaims.filter((claim) => memberOrderIds.has(claim.orderId)),
          options,
        );
      },
    },
    coupons: { list: (options) => respondList(mockCoupons, options) },
    points: { list: (options) => respondList(mockPoints, options) },
    addresses: { list: (options) => respondList(mockAddresses, options) },
    quotes: { list: (options) => respondList(mockQuotes, options) },
    notices: { list: (options) => respondList(mockNotices, options) },
    faqs: { list: (options) => respondList(mockFaqs, options) },
    inquiries: {
      listByMember: (memberId, options) =>
        respondList(
          mockInquiries.filter((inquiry) => inquiry.memberId === memberId),
          options,
        ),
    },
    members: { list: (options) => respondList(mockMembers, options) },
  };
}
