import { assertMockAllowed, type ApiConfig } from './config';
import { ApiError } from './errors';
import { mockAddresses } from './mock/addresses';
import { mockCoupons, mockPoints } from './mock/benefits';
import { mockCategories } from './mock/categories';
import { mockMembers } from './mock/members';
import { mockClaims, mockOrders } from './mock/orders';
import { mockProducts } from './mock/products';
import { mockFaqs, mockInquiries, mockNotices, mockQuotes } from './mock/support';
import type { RequestOptions, ShopApi } from './shop-api';
import type { PagedResult, Product } from './types';

const DEFAULT_PAGE_SIZE = 20;

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
        const filteredProducts = mockProducts.filter(
          (product) =>
            (params.categoryId === undefined || product.categoryId === params.categoryId) &&
            (keyword === '' || product.name.toLowerCase().includes(keyword)),
        );
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
        const allItems = await respondList(filteredProducts, options);
        return {
          items: allItems.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          totalCount: allItems.length,
        };
      },
      getById: (productId, options) =>
        respondOne(
          mockProducts.find((product) => product.id === productId),
          '상품',
          options,
        ),
    },
    categories: { list: (options) => respondList(mockCategories, options) },
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
