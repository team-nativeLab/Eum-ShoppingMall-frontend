'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductLimitParams } from '@eum/api/shop-api';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 검색·탐색 빈 상태에서 사용할 카탈로그 요약 추천 상품을 조회합니다. */
export function useCatalogRecommendedProductsQuery(params: ProductLimitParams = {}) {
  return useQuery({
    queryKey: queryKeys.products.catalogRecommended(params),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.listCatalogRecommended(params, { signal }),
  });
}
