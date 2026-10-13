'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductFacetParams } from '@eum/api/shop-api';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 목록·검색 필터의 카테고리·브랜드·인증별 상품 수를 조회하는 훅 */
export function useProductFacetsQuery(params: ProductFacetParams) {
  return useQuery({
    queryKey: queryKeys.products.facets(params),
    queryFn: async ({ signal }) => (await getShopApi()).products.facets(params, { signal }),
  });
}
