'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductListParams } from '@eum/api/shop-api';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 상품 목록 조회 훅. 로딩·에러 상태는 TanStack Query가 관리하고, 화면을 떠나면 요청을 취소합니다. */
export function useProductsQuery(params: ProductListParams = {}) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: async ({ signal }) => (await getShopApi()).products.list(params, { signal }),
  });
}
