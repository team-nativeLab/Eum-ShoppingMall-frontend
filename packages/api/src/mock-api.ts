import { collectCategoryIdsWithDescendants } from './category-tree';
import { assertMockAllowed, type ApiConfig } from './config';
import { ApiError } from './errors';
import { mockAddresses } from './mock/addresses';
import { mockCoupons, mockPoints } from './mock/benefits';
import { mockCategories } from './mock/categories';
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
  FacetCount,
  HomeContent,
  PagedResult,
  Product,
  ProductFacets,
  ProductReview,
} from './types';

const DEFAULT_PAGE_SIZE = 20;

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
        if (params.sortBy === 'priceAsc' || params.sortBy === 'priceDesc') {
          const direction = params.sortBy === 'priceAsc' ? 1 : -1;
          sortedItems.sort((left, right) => {
            const leftPrice = left.priceVisible ? left.price : null;
            const rightPrice = right.priceVisible ? right.price : null;
            if (leftPrice === null) return rightPrice === null ? 0 : 1;
            if (rightPrice === null) return -1;
            return (leftPrice - rightPrice) * direction;
          });
        } else if (params.sortBy === 'newest') {
          sortedItems.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        }
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
          return { totalCount: 0, categories: [], brands: [], certifications: [] };
        }
        return buildFacets(params);
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
    search: {
      recommendedKeywords: (options) => respondList(mockRecommendedKeywords, options),
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
