'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 상품 상세 조회. 화면을 떠날 때 현재 요청을 취소합니다. */
export function useProductQuery(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: async ({ signal }) => (await getShopApi()).products.getById(productId, { signal }),
    enabled: productId.length > 0,
  });
}
