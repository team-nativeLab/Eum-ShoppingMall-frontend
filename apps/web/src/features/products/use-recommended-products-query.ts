'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductLimitParams } from '@eum/api/shop-api';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 검색 결과 없음 화면의 "추천 상품"을 서버에서 가져오는 훅 */
export function useRecommendedProductsQuery(params: ProductLimitParams = {}) {
  return useQuery({
    queryKey: queryKeys.products.recommended(params),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.listRecommended(params, { signal }),
  });
}
