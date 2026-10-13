'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductLimitParams } from '@eum/api/shop-api';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 상세 화면 "함께 구매하면 좋은 제품"을 서버에서 가져오는 훅 */
export function useRelatedProductsQuery(productId: string, params: ProductLimitParams = {}) {
  return useQuery({
    queryKey: queryKeys.products.related(productId, params),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.listRelated(productId, params, { signal }),
    enabled: productId.length > 0,
  });
}
