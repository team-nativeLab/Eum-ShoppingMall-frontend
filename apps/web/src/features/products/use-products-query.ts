'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductListParams } from '@eum/api/shop-api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 상품 목록 조회 옵션 */
export interface ProductsQueryOptions {
  /** false이면 조회하지 않습니다(예: 카테고리 확인 전). 기본 true */
  enabled?: boolean;
  /**
   * true이면 조건(페이지·필터)이 바뀌어 새로 받는 동안 이전 결과를 그대로 둡니다.
   * 이때 isPlaceholderData가 true이며, 화면은 이전 결과를 흐리게 보여 줍니다.
   */
  shouldKeepPreviousData?: boolean;
}

/** 상품 목록 조회 훅. 로딩·에러 상태는 TanStack Query가 관리하고, 화면을 떠나면 요청을 취소합니다. */
export function useProductsQuery(
  params: ProductListParams = {},
  { enabled = true, shouldKeepPreviousData = false }: ProductsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: async ({ signal }) => (await getShopApi()).products.list(params, { signal }),
    enabled,
    placeholderData: shouldKeepPreviousData ? keepPreviousData : undefined,
  });
}
