'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { ProductListParams } from '@eum/api/shop-api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 구매자 탐색·검색 목록은 상세 데이터가 없는 카탈로그 요약 모델을 조회합니다. */
export function useCatalogProductsQuery(
  params: ProductListParams = {},
  {
    enabled = true,
    shouldKeepPreviousData = false,
  }: { enabled?: boolean; shouldKeepPreviousData?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.products.catalogList(params),
    queryFn: async ({ signal }) => (await getShopApi()).products.listCatalog(params, { signal }),
    enabled,
    placeholderData: shouldKeepPreviousData ? keepPreviousData : undefined,
  });
}
