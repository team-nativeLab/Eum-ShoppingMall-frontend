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
import { mockFaqs, mockInquiries, mockNotices, mockQuotes } from './mock/support';
import type { RequestOptions, ShopApi } from './shop-api';
import type { AdminProduct, HomeContent, PagedResult, Product } from './types';

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
          const matchesKeyword =
            keyword === '' || `${product.name} ${product.brand}`.toLowerCase().includes(keyword);
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
            matchesKeyword &&
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
          .filter((product) =>
            `${product.name} ${product.brand}`.toLowerCase().includes(normalizedKeyword),
          )
          .slice(0, 5)
          .map(({ id, name, brand }) => ({ productId: id, name, brand }));
        return respondList(matches, options);
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
